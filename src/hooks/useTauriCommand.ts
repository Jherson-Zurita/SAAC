// Custom hook placeholder for calling Tauri commands
import { useState } from 'react';

export function useTauriCommand() {
  const [loading, setLoading] = useState(false);
  return { loading, setLoading };
}
