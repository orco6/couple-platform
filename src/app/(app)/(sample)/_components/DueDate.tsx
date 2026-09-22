import { DateText } from '@/core/ui/components/Text';
import type { TaskView } from '@/domain/sample/tasks';

/** Due date with overdue emphasis: colour AND words, so it survives greyscale and screen readers. */
export function DueDate({ task }: { task: Pick<TaskView, 'dueDate' | 'overdue'> }) {
  if (!task.overdue) return <DateText value={task.dueDate} />;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-danger-text">
      <DateText value={task.dueDate} />
      <span className="text-meta">באיחור</span>
    </span>
  );
}
