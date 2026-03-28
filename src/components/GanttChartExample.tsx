
"use client";

import React from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";

const tasks: Task[] = [
  {
    start: new Date(2023, 1, 1),
    end: new Date(2023, 1, 15),
    name: 'Project Start',
    id: 'Task 0',
    type: 'task',
    progress: 100,
    isDisabled: true,
    styles: { progressColor: '#ffbb54', progressSelectedColor: '#ff9e0d' },
  },
  {
    start: new Date(2023, 1, 16),
    end: new Date(2023, 2, 10),
    name: 'Phase 1',
    id: 'Task 1',
    type: 'task',
    progress: 45,
    dependencies: ['Task 0'],
    styles: { progressColor: '#4a86e8', progressSelectedColor: '#3a76d8' },
  }
];

export function GanttChartExample() {
  return (
    <div className="p-4 bg-white rounded-xl shadow-lg border border-slate-200">
      <h2 className="text-xl font-bold mb-4">Gantt Chart Preview (gantt-task-react)</h2>
      <div className="overflow-x-auto">
        <Gantt 
          tasks={tasks} 
          viewMode={ViewMode.Month}
          listCellWidth=""
          columnWidth={60}
        />
      </div>
    </div>
  );
}
