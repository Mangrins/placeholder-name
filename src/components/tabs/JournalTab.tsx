import React from "react";

interface JournalTabProps {
  journalDaily: string;
  setJournalDaily: (value: string) => void;
  journalWeekly: string;
  setJournalWeekly: (value: string) => void;
}

export const JournalTab: React.FC<JournalTabProps> = ({
  journalDaily,
  setJournalDaily,
  journalWeekly,
  setJournalWeekly,
}) => {
  return (
    <section className="panel-grid journal-layout">
      <article className="panel journal-left">
        <h3>Daily Journal</h3>
        <p className="muted">
          Capture what moved today, and what to protect tomorrow.
        </p>
        <textarea
          rows={8}
          placeholder="Daily notes..."
          value={journalDaily}
          onChange={(event) => setJournalDaily(event.target.value)}
        />
      </article>
      <article className="panel journal-right">
        <h3>Weekly Reflection</h3>
        <p className="muted">
          What action improved your deepest work sessions this week?
        </p>
        <textarea
          className="reflection-area journal-reflection-area"
          placeholder="Write your reflection..."
          value={journalWeekly}
          onChange={(event) => setJournalWeekly(event.target.value)}
        />
      </article>
    </section>
  );
};
