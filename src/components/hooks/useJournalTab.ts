import { useState } from 'react';

export const useJournalTab = () => {
  const [journalDaily, setJournalDaily] = useState("");
  const [journalWeekly, setJournalWeekly] = useState("");

  return {
    journalDaily,
    setJournalDaily,
    journalWeekly,
    setJournalWeekly,
  };
};