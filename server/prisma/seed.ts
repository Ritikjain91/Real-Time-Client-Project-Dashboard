import { PrismaClient, Role, TaskStatus, TaskPriority, ActivityAction, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'node:process';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing records in correct relation order
  await prisma.notification.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create Users (1 Admin, 2 PMs, 4 Developers)
  const admin = await prisma.user.create({
    data: {
      name: 'Eleanor Vance (Admin)',
      email: 'admin@agency.com',
      passwordHash,
      role: Role.ADMIN,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  });

  const pmSarah = await prisma.user.create({
    data: {
      name: 'Sarah Connor (PM)',
      email: 'sarah.pm@agency.com',
      passwordHash,
      role: Role.PROJECT_MANAGER,
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    },
  });

  const pmMarcus = await prisma.user.create({
    data: {
      name: 'Marcus Brody (PM)',
      email: 'marcus.pm@agency.com',
      passwordHash,
      role: Role.PROJECT_MANAGER,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
  });

  const devAlex = await prisma.user.create({
    data: {
      name: 'Alex Rivera (Dev)',
      email: 'alex.dev@agency.com',
      passwordHash,
      role: Role.DEVELOPER,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    },
  });

  const devPriya = await prisma.user.create({
    data: {
      name: 'Priya Sharma (Dev)',
      email: 'priya.dev@agency.com',
      passwordHash,
      role: Role.DEVELOPER,
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    },
  });

  const devDavid = await prisma.user.create({
    data: {
      name: 'David Chen (Dev)',
      email: 'david.dev@agency.com',
      passwordHash,
      role: Role.DEVELOPER,
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    },
  });

  const devElena = await prisma.user.create({
    data: {
      name: 'Elena Rostova (Dev)',
      email: 'elena.dev@agency.com',
      passwordHash,
      role: Role.DEVELOPER,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    },
  });

  console.log('✅ Created 7 Users (1 Admin, 2 PMs, 4 Developers)');

  // 2. Create Clients
  const clientAcme = await prisma.client.create({
    data: {
      name: 'Acme Technologies',
      company: 'Acme Global Holdings',
      email: 'contact@acme.example.com',
      phone: '+1 (555) 234-5678',
    },
  });

  const clientFinovate = await prisma.client.create({
    data: {
      name: 'Finovate Labs',
      company: 'Finovate Financial Group',
      email: 'ops@finovate.example.com',
      phone: '+1 (555) 876-5432',
    },
  });

  const clientHealth = await prisma.client.create({
    data: {
      name: 'HealthPulse Dynamics',
      company: 'HealthPulse Systems',
      email: 'contact@healthpulse.example.com',
      phone: '+1 (555) 345-6789',
    },
  });

  console.log('✅ Created 3 Clients');

  // 3. Create Projects
  const now = new Date();

  // Project 1: Managed by Sarah
  const project1 = await prisma.project.create({
    data: {
      title: 'Acme Cloud Migration & Infrastructure',
      description: 'Modernizing legacy monolith infrastructure to AWS multi-region microservices architecture with Kubernetes.',
      clientId: clientAcme.id,
      managerId: pmSarah.id,
      budget: 85000,
      deadline: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
    },
  });

  // Project 2: Managed by Sarah
  const project2 = await prisma.project.create({
    data: {
      title: 'Finovate Real-Time Trading Engine',
      description: 'High-throughput low-latency algorithmic trade execution backend with WebSocket order book integration.',
      clientId: clientFinovate.id,
      managerId: pmSarah.id,
      budget: 120000,
      deadline: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
    },
  });

  // Project 3: Managed by Marcus
  const project3 = await prisma.project.create({
    data: {
      title: 'HealthPulse Telehealth Mobile App',
      description: 'HIPAA-compliant patient video consultation portal, medication tracker, and provider calendar sync.',
      clientId: clientHealth.id,
      managerId: pmMarcus.id,
      budget: 64000,
      deadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Created 3 Projects across 2 Project Managers');

  // Dates for tasks
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // 4. Create Tasks (at least 5+ tasks each, with 2+ overdue)
  // Project 1 Tasks (Sarah)
  const task1_1 = await prisma.task.create({
    data: {
      title: 'Security Compliance & SOC2 Audit Prep',
      description: 'Audit IAM policies, verify VPC peering routing tables, and ensure encryption at rest for S3 buckets.',
      projectId: project1.id,
      assignedToId: devAlex.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: fiveDaysAgo, // OVERDUE
      isOverdue: true,
    },
  });

  const task1_2 = await prisma.task.create({
    data: {
      title: 'PostgreSQL RDS Read-Replica Configuration',
      description: 'Provision secondary read replica in us-east-2 to offload intensive analytics queries and backup jobs.',
      projectId: project1.id,
      assignedToId: devPriya.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: tomorrow,
      isOverdue: false,
    },
  });

  const task1_3 = await prisma.task.create({
    data: {
      title: 'Docker Image Multi-Stage Optimization',
      description: 'Reduce production container footprint from 1.2GB to <180MB using Alpine base and multi-stage builds.',
      projectId: project1.id,
      assignedToId: devAlex.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      dueDate: twoDaysAgo,
      isOverdue: false,
    },
  });

  const task1_4 = await prisma.task.create({
    data: {
      title: 'Terraform Infrastructure as Code Scripts',
      description: 'Declare VPC subnets, NAT gateways, security groups, and EKS cluster configuration in Git.',
      projectId: project1.id,
      assignedToId: devDavid.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: nextWeek,
      isOverdue: false,
    },
  });

  const task1_5 = await prisma.task.create({
    data: {
      title: 'Kubernetes Ingress Controller & TLS Certs',
      description: 'Deploy Cert-Manager with Let’s Encrypt automated challenge renewal and Nginx Ingress routing.',
      projectId: project1.id,
      assignedToId: devAlex.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: twoWeeksLater,
      isOverdue: false,
    },
  });

  const task1_6 = await prisma.task.create({
    data: {
      title: 'Stripe Billing Webhook Idempotency',
      description: 'Ensure incoming webhook events cannot trigger duplicate subscription renewals or invoice events.',
      projectId: project1.id,
      assignedToId: devPriya.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.CRITICAL,
      dueDate: twoDaysAgo, // OVERDUE
      isOverdue: true,
    },
  });

  // Project 2 Tasks (Sarah)
  const task2_1 = await prisma.task.create({
    data: {
      title: 'Fix High-Frequency Order Book Memory Leak',
      description: 'Profile heap allocations in the matching engine worker when processing >50k websocket ticks/sec.',
      projectId: project2.id,
      assignedToId: devPriya.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: tomorrow,
      isOverdue: false,
    },
  });

  const task2_2 = await prisma.task.create({
    data: {
      title: 'WebSocket Connection Fallback Handshake',
      description: 'Handle rapid network drops on mobile clients with instant reconnect and exponential backoff retry.',
      projectId: project2.id,
      assignedToId: devDavid.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      dueDate: twoDaysAgo,
      isOverdue: false,
    },
  });

  const task2_3 = await prisma.task.create({
    data: {
      title: 'KYC Verification Webhook Consumer',
      description: 'Integrate verification callbacks from Onfido with automated account tier promotion.',
      projectId: project2.id,
      assignedToId: devElena.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.MEDIUM,
      dueDate: nextWeek,
      isOverdue: false,
    },
  });

  const task2_4 = await prisma.task.create({
    data: {
      title: 'Redis Pub/Sub Market Feed Cluster',
      description: 'Configure distributed redis cluster with Sentinel for fault-tolerant order ticker broadcasting.',
      projectId: project2.id,
      assignedToId: devAlex.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: nextWeek,
      isOverdue: false,
    },
  });

  const task2_5 = await prisma.task.create({
    data: {
      title: 'Exchange Rate Slippage Calculation Test Suite',
      description: 'Implement unit tests validating slippage edge-case calculations during market volatility swings.',
      projectId: project2.id,
      assignedToId: devPriya.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: twoWeeksLater,
      isOverdue: false,
    },
  });

  // Project 3 Tasks (Marcus)
  const task3_1 = await prisma.task.create({
    data: {
      title: 'WebRTC Video Stream Token Exchange',
      description: 'Implement ephemeral signaling session token generation for peer-to-peer telehealth video rooms.',
      projectId: project3.id,
      assignedToId: devElena.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: tomorrow,
      isOverdue: false,
    },
  });

  const task3_2 = await prisma.task.create({
    data: {
      title: 'Patient Health History PDF Export',
      description: 'Serverless PDF generation with HIPAA-safe patient chart rendering and password encryption.',
      projectId: project3.id,
      assignedToId: devDavid.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: nextWeek,
      isOverdue: false,
    },
  });

  const task3_3 = await prisma.task.create({
    data: {
      title: 'Appointment SMS Reminder Integration',
      description: 'Twilio webhook integration dispatching localized SMS alerts 24 hours and 1 hour prior to visit.',
      projectId: project3.id,
      assignedToId: devElena.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      dueDate: twoDaysAgo,
      isOverdue: false,
    },
  });

  const task3_4 = await prisma.task.create({
    data: {
      title: 'Doctor Schedule Availability Matrix',
      description: 'Recurring time-slot generation accounting for timezones, lunch buffers, and holiday blackouts.',
      projectId: project3.id,
      assignedToId: devDavid.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: nextWeek,
      isOverdue: false,
    },
  });

  const task3_5 = await prisma.task.create({
    data: {
      title: 'Prescription Digital Signature Pad',
      description: 'Canvas-based cryptographic signature capture component for registered medical practitioners.',
      projectId: project3.id,
      assignedToId: devElena.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: twoWeeksLater,
      isOverdue: false,
    },
  });

  console.log('✅ Created 16 Tasks across 3 Projects with 2 Overdue');

  // 5. Pre-existing Activity Log Entries (so feed is not empty on first load)
  const activities = [
    {
      taskId: task1_2.id,
      projectId: project1.id,
      userId: devPriya.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.IN_PROGRESS,
      newStatus: TaskStatus.IN_REVIEW,
      details: 'Priya Sharma moved Task "PostgreSQL RDS Read-Replica Configuration" from In Progress → In Review',
      createdAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 mins ago
    },
    {
      taskId: task1_1.id,
      projectId: project1.id,
      userId: pmSarah.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.TODO,
      newStatus: TaskStatus.IN_PROGRESS,
      details: 'Sarah Connor moved Task "Security Compliance & SOC2 Audit Prep" from To Do → In Progress',
      createdAt: new Date(now.getTime() - 45 * 60 * 1000), // 45 mins ago
    },
    {
      taskId: task2_2.id,
      projectId: project2.id,
      userId: devDavid.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.IN_REVIEW,
      newStatus: TaskStatus.DONE,
      details: 'David Chen moved Task "WebSocket Connection Fallback Handshake" from In Review → Done',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      taskId: task1_3.id,
      projectId: project1.id,
      userId: devAlex.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.IN_REVIEW,
      newStatus: TaskStatus.DONE,
      details: 'Alex Rivera moved Task "Docker Image Multi-Stage Optimization" from In Review → Done',
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
    },
    {
      taskId: task3_1.id,
      projectId: project3.id,
      userId: devElena.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.TODO,
      newStatus: TaskStatus.IN_PROGRESS,
      details: 'Elena Rostova moved Task "WebRTC Video Stream Token Exchange" from To Do → In Progress',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      taskId: task3_2.id,
      projectId: project3.id,
      userId: devDavid.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.IN_PROGRESS,
      newStatus: TaskStatus.IN_REVIEW,
      details: 'David Chen moved Task "Patient Health History PDF Export" from In Progress → In Review',
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      taskId: task1_6.id,
      projectId: project1.id,
      userId: admin.id,
      action: ActivityAction.TASK_OVERDUE,
      previousStatus: TaskStatus.TODO,
      newStatus: TaskStatus.TODO,
      details: 'System flagged Task "Stripe Billing Webhook Idempotency" as Overdue · deadline was 2 days ago',
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
    },
    {
      taskId: task2_1.id,
      projectId: project2.id,
      userId: devPriya.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.TODO,
      newStatus: TaskStatus.IN_PROGRESS,
      details: 'Priya Sharma moved Task "Fix High-Frequency Order Book Memory Leak" from To Do → In Progress',
      createdAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
    },
    {
      taskId: task3_3.id,
      projectId: project3.id,
      userId: devElena.id,
      action: ActivityAction.STATUS_CHANGE,
      previousStatus: TaskStatus.IN_REVIEW,
      newStatus: TaskStatus.DONE,
      details: 'Elena Rostova moved Task "Appointment SMS Reminder Integration" from In Review → Done',
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
  ];

  for (const act of activities) {
    await prisma.taskActivity.create({ data: act });
  }

  console.log(`✅ Created ${activities.length} Pre-existing Activity Log entries`);

  // 6. Pre-existing In-App Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: devPriya.id,
        taskId: task1_2.id,
        title: 'New Task Assigned',
        message: 'You were assigned to "PostgreSQL RDS Read-Replica Configuration" in Acme Cloud Migration',
        type: NotificationType.TASK_ASSIGNED,
        isRead: false,
      },
      {
        userId: pmSarah.id,
        taskId: task1_2.id,
        title: 'Task Ready for Review',
        message: 'Priya Sharma moved "PostgreSQL RDS Read-Replica Configuration" to In Review',
        type: NotificationType.TASK_IN_REVIEW,
        isRead: false,
      },
      {
        userId: devAlex.id,
        taskId: task1_1.id,
        title: 'Task Overdue',
        message: 'Task "Security Compliance & SOC2 Audit Prep" has exceeded its due date',
        type: NotificationType.TASK_OVERDUE,
        isRead: false,
      },
      {
        userId: pmMarcus.id,
        taskId: task3_2.id,
        title: 'Task Ready for Review',
        message: 'David Chen moved "Patient Health History PDF Export" to In Review',
        type: NotificationType.TASK_IN_REVIEW,
        isRead: true,
      },
    ],
  });

  console.log('✅ Created Pre-existing Notifications');
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
