import { create } from 'zustand';
import type { Song } from '../api/types';

interface SongMenuStore {
  song: Song | null;
  open: (song: Song) => void;
  close: () => void;
}

export const useSongMenu = create<SongMenuStore>((set) => ({
  song: null,
  open: (song) => set({ song }),
  close: () => set({ song: null }),
}));
