import React from "react";
import { format } from "date-fns";
import { Category, Task, TaskSubtask } from "../../domain/types";
import {
  makeId,
  inputDateFromISO,
  isoFromInputDate,
  recurrenceSummary,
} from "../../utils/appUtils";

interface TaskDraft {
  title: string;
  categoryId: string;
  priority: "low" | "medium" | "high";
  deadlineAt: string;
  estimateMinutes: number;
  tagsText: string;
  notes: string;
  recurrenceMode: "none" | "daily_interval" | "weekly_days" | "custom";
  recurrenceEvery: number;
  recurrenceWeekdays: number[];
  recurrenceRuleText: string;
  subtasks: TaskSubtask[];
}

interface TasksTabProps {
  taskTitle: string;
  setTaskTitle: (value: string) => void;
  taskCategory: string;
  setTaskCategory: (value: string) => void;
  taskPriority: "low" | "medium" | "high";
  setTaskPriority: (value: "low" | "medium" | "high") => void;
  taskDeadline: string;
  setTaskDeadline: (value: string) => void;
  createQuickTask: () => Promise<void>;
  openTaskEditor: (task?: Task) => void;
  categories: Category[];
  taskFilter: string;
  setTaskFilter: (value: string) => void;
  taskSearch: string;
  setTaskSearch: (value: string) => void;
  filteredTasks: Task[];
  deleteTask: (id: string) => Promise<void>;
  handleCompleteTask: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  taskEditorOpen: boolean;
  setTaskEditorOpen: (value: boolean) => void;
  editingTaskId: string | null;
  taskDraft: TaskDraft;
  setTaskDraft: (value: TaskDraft) => void;
  subtaskInput: string;
  setSubtaskInput: (value: string) => void;
  saveTaskEditor: () => Promise<void>;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  taskTitle,
  setTaskTitle,
  taskCategory,
  setTaskCategory,
  taskPriority,
  setTaskPriority,
  taskDeadline,
  setTaskDeadline,
  createQuickTask,
  openTaskEditor,
  categories,
  taskFilter,
  setTaskFilter,
  taskSearch,
  setTaskSearch,
  filteredTasks,
  deleteTask,
  handleCompleteTask,
  reopenTask,
  taskEditorOpen,
  setTaskEditorOpen,
  editingTaskId,
  taskDraft,
  setTaskDraft,
  subtaskInput,
  setSubtaskInput,
  saveTaskEditor,
}) => {
  return (
    <section className="panel-grid tasks-layout">
      <article className="panel">
        <h3>Quick Add Task</h3>
        <div className="form-grid">
          <input
            id="task-quick-add"
            placeholder="Defeat backlog item..."
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createQuickTask();
            }}
          />
          <select
            value={taskCategory}
            onChange={(event) => setTaskCategory(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={taskPriority}
            onChange={(event) =>
              setTaskPriority(event.target.value as "low" | "medium" | "high")
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            className="date-themed"
            type="date"
            value={taskDeadline}
            onChange={(event) => setTaskDeadline(event.target.value)}
          />
          <div className="row">
            <button onClick={() => void createQuickTask()}>Create</button>
            <button className="ghost" onClick={() => openTaskEditor()}>
              Advanced editor
            </button>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="row space wrap">
          <h3>Task Board</h3>
          <div className="row wrap">
            {(["today", "upcoming", "active", "completed", "all"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  className={taskFilter === filter ? "pill active" : "pill"}
                  onClick={() => setTaskFilter(filter)}
                >
                  {filter}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="row" style={{ marginBottom: "0.7rem" }}>
          <input
            value={taskSearch}
            onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="Search title, notes, tags, recurrence..."
          />
        </div>

        <div className="task-list">
          {filteredTasks.map((task) => {
            const subtaskDone =
              task.subtasks?.filter((subtask) => subtask.done).length ?? 0;
            const subtaskTotal = task.subtasks?.length ?? 0;
            const deadline = task.deadlineAt
              ? format(new Date(task.deadlineAt), "MMM dd")
              : null;

            return (
              <div
                key={task.id}
                className={
                  task.status === "done" ? "task-row done" : "task-row"
                }
              >
                <div>
                  <strong>{task.title}</strong>
                  <div className="muted">
                    {task.categoryId} • {task.priority}
                    {deadline ? ` • due ${deadline}` : ""}
                    {task.recurrenceRule ? ` • ${task.recurrenceRule}` : ""}
                  </div>
                  {subtaskTotal > 0 && (
                    <div className="muted">
                      Checklist: {subtaskDone}/{subtaskTotal}
                    </div>
                  )}
                  {task.tags.length > 0 && (
                    <div className="row wrap" style={{ marginTop: "0.2rem" }}>
                      {task.tags.map((tag) => (
                        <span key={tag} className="badge">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="row wrap">
                  <button
                    className="small ghost"
                    onClick={() => openTaskEditor(task)}
                  >
                    Edit
                  </button>
                  <button
                    className="small ghost"
                    onClick={() => void deleteTask(task.id)}
                  >
                    Delete
                  </button>
                  {task.status !== "done" ? (
                    <button
                      className="small"
                      onClick={() => void handleCompleteTask(task.id)}
                    >
                      Complete
                    </button>
                  ) : (
                    <button
                      className="small"
                      onClick={() => void reopenTask(task.id)}
                    >
                      Uncheck
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredTasks.length === 0 && (
            <div className="muted">No tasks match this filter.</div>
          )}
        </div>
      </article>

      {taskEditorOpen && (
        <div className="modal-overlay" onClick={() => setTaskEditorOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTaskId ? "Edit Task" : "Create Task"}</h3>
              <button
                className="close-button"
                onClick={() => setTaskEditorOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <input
                  placeholder="Task title"
                  value={taskDraft.title}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, title: e.target.value })
                  }
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={taskDraft.notes}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, notes: e.target.value })
                  }
                  rows={3}
                />
                <select
                  value={taskDraft.categoryId}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, categoryId: e.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  value={taskDraft.priority}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      priority: e.target.value as "low" | "medium" | "high",
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  className="date-themed"
                  type="date"
                  value={inputDateFromISO(taskDraft.deadlineAt)}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      deadlineAt: isoFromInputDate(e.target.value) || "",
                    })
                  }
                />
                <input
                  placeholder="Tags (comma separated)"
                  value={taskDraft.tagsText}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, tagsText: e.target.value })
                  }
                />
                <input
                  placeholder="Recurrence rule (optional)"
                  value={taskDraft.recurrenceRuleText}
                  onChange={(e) =>
                    setTaskDraft({
                      ...taskDraft,
                      recurrenceRuleText: e.target.value,
                    })
                  }
                />
                {taskDraft.recurrenceRuleText && (
                  <div className="muted">
                    {recurrenceSummary(
                      taskDraft.recurrenceMode,
                      taskDraft.recurrenceEvery,
                      taskDraft.recurrenceWeekdays,
                      taskDraft.recurrenceRuleText,
                    )}
                  </div>
                )}
              </div>

              <h4>Checklist</h4>
              <div className="form-grid">
                <input
                  placeholder="Add subtask"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (subtaskInput.trim()) {
                        setTaskDraft({
                          ...taskDraft,
                          subtasks: [
                            ...taskDraft.subtasks,
                            {
                              id: makeId(),
                              title: subtaskInput.trim(),
                              done: false,
                            },
                          ],
                        });
                        setSubtaskInput("");
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (subtaskInput.trim()) {
                      setTaskDraft({
                        ...taskDraft,
                        subtasks: [
                          ...taskDraft.subtasks,
                          {
                            id: makeId(),
                            title: subtaskInput.trim(),
                            done: false,
                          },
                        ],
                      });
                      setSubtaskInput("");
                    }
                  }}
                >
                  Add
                </button>
              </div>
              {taskDraft.subtasks.length > 0 && (
                <div className="subtask-list">
                  {taskDraft.subtasks.map((subtask, index) => (
                    <div key={subtask.id} className="subtask-row">
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={(e) =>
                          setTaskDraft({
                            ...taskDraft,
                            subtasks: taskDraft.subtasks.map((s, i) =>
                              i === index
                                ? { ...s, done: e.target.checked }
                                : s,
                            ),
                          })
                        }
                      />
                      <input
                        value={subtask.title}
                        onChange={(e) =>
                          setTaskDraft({
                            ...taskDraft,
                            subtasks: taskDraft.subtasks.map((s, i) =>
                              i === index ? { ...s, title: e.target.value } : s,
                            ),
                          })
                        }
                      />
                      <button
                        className="small ghost"
                        onClick={() =>
                          setTaskDraft({
                            ...taskDraft,
                            subtasks: taskDraft.subtasks.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="ghost"
                onClick={() => setTaskEditorOpen(false)}
              >
                Cancel
              </button>
              <button onClick={() => void saveTaskEditor()}>
                {editingTaskId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
