import { loginUser, rotateRefreshToken, createRefreshToken } from '../services/auth.service';
import { getProjectsForUser, getProjectById } from '../services/project.service';
import { getTasksForUser, getTaskById, updateTaskStatus } from '../services/task.service';
import { getActivityFeedForUser } from '../services/activity.service';
import { getNotificationsForUser } from '../services/notification.service';
import { scanForOverdueTasks } from '../jobs/overdueScanner';
import { prisma } from '../lib/prisma';
import { Role, TaskStatus } from '@prisma/client';

async function runTests() {
  console.log('\n=============================================');
  console.log('🧪 RUNNING RBAC & REAL-TIME TEST SUITE');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Authentication Tests
    console.log('1. Authentication & Token Generation:');
    const adminAuth = await loginUser('admin@agency.com', 'Password123!');
    assert(!!adminAuth.accessToken && adminAuth.user.role === Role.ADMIN, 'Admin can authenticate with JWT');

    const pmSarahAuth = await loginUser('sarah.pm@agency.com', 'Password123!');
    assert(!!pmSarahAuth.accessToken && pmSarahAuth.user.role === Role.PROJECT_MANAGER, 'PM Sarah can authenticate');

    const pmMarcusAuth = await loginUser('marcus.pm@agency.com', 'Password123!');
    assert(!!pmMarcusAuth.accessToken && pmMarcusAuth.user.role === Role.PROJECT_MANAGER, 'PM Marcus can authenticate');

    const devAlexAuth = await loginUser('alex.dev@agency.com', 'Password123!');
    assert(!!devAlexAuth.accessToken && devAlexAuth.user.role === Role.DEVELOPER, 'Dev Alex can authenticate');

    const devPriyaAuth = await loginUser('priya.dev@agency.com', 'Password123!');
    assert(!!devPriyaAuth.accessToken && devPriyaAuth.user.role === Role.DEVELOPER, 'Dev Priya can authenticate');

    // 2. Refresh Token Rotation
    console.log('\n2. Refresh Token Rotation:');
    const rotated = await rotateRefreshToken(pmSarahAuth.refreshToken);
    assert(!!rotated.accessToken && rotated.refreshToken !== pmSarahAuth.refreshToken, 'Refresh token rotates successfully and issues new tokens');

    let oldTokenRejected = false;
    try {
      await rotateRefreshToken(pmSarahAuth.refreshToken);
    } catch {
      oldTokenRejected = true;
    }
    assert(oldTokenRejected, 'Old revoked refresh token is strictly rejected');

    // 3. Project Scoping & RBAC
    console.log('\n3. Project Scoping & RBAC Enforcement:');
    const adminProjects = await getProjectsForUser({
      userId: adminAuth.user.id,
      email: adminAuth.user.email,
      role: Role.ADMIN,
      name: adminAuth.user.name,
    });
    assert(adminProjects.length === 3, `Admin sees all 3 projects (found ${adminProjects.length})`);

    const sarahProjects = await getProjectsForUser({
      userId: pmSarahAuth.user.id,
      email: pmSarahAuth.user.email,
      role: Role.PROJECT_MANAGER,
      name: pmSarahAuth.user.name,
    });
    assert(sarahProjects.length === 2, `PM Sarah sees ONLY her 2 projects (found ${sarahProjects.length})`);

    const marcusProjects = await getProjectsForUser({
      userId: pmMarcusAuth.user.id,
      email: pmMarcusAuth.user.email,
      role: Role.PROJECT_MANAGER,
      name: pmMarcusAuth.user.name,
    });
    assert(marcusProjects.length === 1, `PM Marcus sees ONLY his 1 project (found ${marcusProjects.length})`);

    // Cross-PM Access Denial
    let crossPmForbidden = false;
    try {
      // Marcus trying to inspect Sarah's project directly
      await getProjectById(sarahProjects[0].id, {
        userId: pmMarcusAuth.user.id,
        email: pmMarcusAuth.user.email,
        role: Role.PROJECT_MANAGER,
        name: pmMarcusAuth.user.name,
      });
    } catch (err: any) {
      if (err.statusCode === 403) crossPmForbidden = true;
    }
    assert(crossPmForbidden, "PM Marcus is forbidden (403) from accessing PM Sarah's project");

    // 4. Developer Task Isolation
    console.log('\n4. Developer Task Isolation:');
    const alexTasks = await getTasksForUser(
      {
        userId: devAlexAuth.user.id,
        email: devAlexAuth.user.email,
        role: Role.DEVELOPER,
        name: devAlexAuth.user.name,
      },
      {}
    );
    const hasOnlyAlexTasks = alexTasks.every((t) => t.assignedToId === devAlexAuth.user.id);
    assert(alexTasks.length > 0 && hasOnlyAlexTasks, `Developer Alex sees only tasks assigned to him (${alexTasks.length} tasks)`);

    // Cross-developer access denial
    let devCrossForbidden = false;
    try {
      await getTaskById(alexTasks[0].id, {
        userId: devPriyaAuth.user.id,
        email: devPriyaAuth.user.email,
        role: Role.DEVELOPER,
        name: devPriyaAuth.user.name,
      });
    } catch (err: any) {
      if (err.statusCode === 403) devCrossForbidden = true;
    }
    assert(devCrossForbidden, "Dev Priya cannot access Dev Alex's assigned task (403 Forbidden)");

    // 5. Task Status Transition & Database Activity Logging
    console.log('\n5. Task Status Transition, Activity Logging & Notifications:');
    // Find task assigned to Priya
    const priyaTasks = await getTasksForUser(
      {
        userId: devPriyaAuth.user.id,
        email: devPriyaAuth.user.email,
        role: Role.DEVELOPER,
        name: devPriyaAuth.user.name,
      },
      {}
    );
    const taskToMove = priyaTasks.find((t) => t.status === TaskStatus.TODO) || priyaTasks[0];

    await updateTaskStatus(taskToMove.id, TaskStatus.IN_REVIEW, {
      userId: devPriyaAuth.user.id,
      email: devPriyaAuth.user.email,
      role: Role.DEVELOPER,
      name: devPriyaAuth.user.name,
    });

    // Check that activity log was inserted into the database
    const latestActivity = await prisma.taskActivity.findFirst({
      where: { taskId: taskToMove.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(
      !!latestActivity && latestActivity.details.includes('In Review'),
      `Activity log inserted in DB: "${latestActivity?.details}"`
    );

    // Check that PM received in-app notification for "IN_REVIEW"
    const pmNotifications = await getNotificationsForUser(pmSarahAuth.user.id);
    const inReviewNotif = pmNotifications.find((n) => n.taskId === taskToMove.id && n.type === 'TASK_IN_REVIEW');
    assert(!!inReviewNotif, `PM received notification for review: "${inReviewNotif?.title} - ${inReviewNotif?.message}"`);

    // 6. Role-Filtered Activity Feed Catchup (Last 20 items from DB)
    console.log('\n6. Role-Filtered Activity Feed (Offline Catchup):');
    const adminFeed = await getActivityFeedForUser({
      userId: adminAuth.user.id,
      email: adminAuth.user.email,
      role: Role.ADMIN,
      name: adminAuth.user.name,
    });
    assert(adminFeed.length > 0, `Admin feed catches up on all global events (${adminFeed.length} entries)`);

    const devFeed = await getActivityFeedForUser({
      userId: devAlexAuth.user.id,
      email: devAlexAuth.user.email,
      role: Role.DEVELOPER,
      name: devAlexAuth.user.name,
    });
    const devFeedValid = devFeed.every((a) => a.task.id && alexTasks.some((t) => t.id === a.taskId));
    assert(devFeedValid, `Developer feed catches up strictly on their assigned tasks (${devFeed.length} entries)`);

    // 7. Scheduled Overdue Scanner Execution
    console.log('\n7. Background Overdue Scanner:');
    const scanResult = await scanForOverdueTasks();
    assert(typeof scanResult === 'number', `Overdue task scanner executed cleanly (processed ${scanResult} items)`);

    console.log('\n=============================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================\n');

    if (failed > 0) process.exit(1);
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
