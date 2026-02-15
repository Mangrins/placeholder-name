import { useState } from 'react';
import { buildSnapshot, todayRange } from '../../snapshot/buildSnapshot';

export const useSettingsTab = () => {
  const [snapshotPreview, setSnapshotPreview] = useState("");

  const runSnapshot = () => {
    void buildSnapshot(todayRange()).then((snapshot: any) => {
      setSnapshotPreview(JSON.stringify(snapshot, null, 2));
    });
  };

  return {
    snapshotPreview,
    setSnapshotPreview,
    runSnapshot,
  };
};;