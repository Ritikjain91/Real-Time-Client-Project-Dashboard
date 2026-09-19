import React from 'react';
import { Search, Filter, X } from 'lucide-react';

export interface FilterState {
  status: string;
  priority: string;
  dueDateRange: string;
  search: string;
}

interface TaskFiltersProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({ filters, onChange }) => {
  const handleFieldChange = (key: keyof FilterState, value: string) => {
    const updated = { ...filters, [key]: value };
    onChange(updated);

    // Synchronize to URL query parameters for shareable URLs
    const params = new URLSearchParams();
    if (updated.status) params.set('status', updated.status);
    if (updated.priority) params.set('priority', updated.priority);
    if (updated.dueDateRange) params.set('dueDateRange', updated.dueDateRange);
    if (updated.search) params.set('search', updated.search);

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.pushState(null, '', newUrl);
  };

  const handleClear = () => {
    const cleared: FilterState = { status: '', priority: '', dueDateRange: '', search: '' };
    onChange(cleared);
    window.history.pushState(null, '', window.location.pathname);
  };

  const hasActiveFilters = Boolean(
    filters.status || filters.priority || filters.dueDateRange || filters.search
  );

  return (
    <div className="filter-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
        <Filter size={16} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filters:</span>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', minWidth: '220px' }}>
        <Search
          size={15}
          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
        />
        <input
          type="text"
          placeholder="Search task title..."
          className="filter-input"
          style={{ paddingLeft: '32px', width: '100%' }}
          value={filters.search}
          onChange={(e) => handleFieldChange('search', e.target.value)}
        />
      </div>

      {/* Status Filter */}
      <select
        className="filter-select"
        value={filters.status}
        onChange={(e) => handleFieldChange('status', e.target.value)}
        aria-label="Filter by Status"
      >
        <option value="">All Statuses</option>
        <option value="TODO">To Do</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="IN_REVIEW">In Review</option>
        <option value="DONE">Done</option>
      </select>

      {/* Priority Filter */}
      <select
        className="filter-select"
        value={filters.priority}
        onChange={(e) => handleFieldChange('priority', e.target.value)}
        aria-label="Filter by Priority"
      >
        <option value="">All Priorities</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>

      {/* Due Date Range Filter */}
      <select
        className="filter-select"
        value={filters.dueDateRange}
        onChange={(e) => handleFieldChange('dueDateRange', e.target.value)}
        aria-label="Filter by Due Date Range"
      >
        <option value="">All Deadlines</option>
        <option value="overdue">Overdue Only</option>
        <option value="today">Due Today</option>
        <option value="week">Due This Week</option>
        <option value="future">Due Later</option>
      </select>

      {/* Clear Button */}
      {hasActiveFilters && (
        <button
          onClick={handleClear}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.4rem 0.75rem', gap: '0.25rem' }}
        >
          <X size={13} />
          Clear
        </button>
      )}
    </div>
  );
};
