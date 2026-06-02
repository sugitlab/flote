export type NoteType = "markdown" | "excalidraw";

export type Note = {
  id: string;
  title: string;
  body_md: string;
  pinned: boolean;
  note_type: NoteType;
  updated_at: string;
};

export type NoteInsert = Omit<Note, "id" | "updated_at">;
export type NoteUpdate = Partial<Omit<Note, "id">>;
