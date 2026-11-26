import type { NoteCreateInput } from "@repo/api-client";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { noteQueries } from "./clients";
import type { ExportFormat, Item, Note, Project } from "./types";

export function useNoteItemsQuery(opts: { enabled?: boolean } = {}) {
  return useQuery({
    ...noteQueries.note.items(),
    enabled: opts.enabled ?? true,
  });
}

export function useNoteImportableItemsQuery(enabled: boolean) {
  return useQuery({
    ...noteQueries.note.importableItems(),
    enabled,
  });
}

export function useNoteItemQuery(id: string) {
  return useQuery(noteQueries.note.item(id));
}

export function useNotesQuery() {
  return useQuery(noteQueries.note.notes());
}

export function useNoteQuery(id: string | undefined) {
  return useQuery(noteQueries.note.note(id ?? ""));
}

export function useNoteProjectsQuery() {
  return useQuery(noteQueries.note.projects());
}

export function useNoteProjectQuery(id: string) {
  return useQuery(noteQueries.note.project(id));
}

export function useNoteTagsQuery() {
  return useQuery(noteQueries.note.tags());
}

export function useNoteAnalyzeQuery(projectId?: string) {
  return useQuery(noteQueries.note.analyze(projectId));
}

export function useNoteExportPreviewQuery(noteId: string, format: ExportFormat) {
  return useQuery(noteQueries.note.exportPreview(noteId, format));
}

export function useAddNoteItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.addItem(url),
    onSuccess: (item) => {
      queryClient.setQueryData(hazyQueryKeys.note.item(item.id), item);
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.items() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.importableItems() });
    },
  });
}

export function useFinishReadingNoteItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.finishReading(id),
    onSuccess: (item) => {
      queryClient.setQueryData(hazyQueryKeys.note.item(item.id), item);
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.items() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.tags() });
    },
  });
}

export function useUpdateNoteItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Item> }) => api.updateItem(id, patch),
    onSuccess: (item) => {
      queryClient.setQueryData(hazyQueryKeys.note.item(item.id), item);
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.items() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.projects() });
      if (item.projectId) {
        void queryClient.invalidateQueries({
          queryKey: hazyQueryKeys.note.project(item.projectId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.tags() });
      void queryClient.invalidateQueries({ queryKey: ["note", "analyze"] });
    },
  });
}

export function useDeleteNoteItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onMutate: async (id) => {
      const key = hazyQueryKeys.note.items();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Item[]>(key);
      if (previous) {
        queryClient.setQueryData<Item[]>(
          key,
          previous.filter((it) => it.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(hazyQueryKeys.note.items(), ctx.previous);
      }
    },
    onSuccess: (_res, id) => {
      queryClient.removeQueries({ queryKey: hazyQueryKeys.note.item(id) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.items() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.importableItems() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.projects() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.tags() });
      void queryClient.invalidateQueries({ queryKey: ["note", "analyze"] });
    },
  });
}

export function useCreateNoteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; tone?: "accent" | "neutral" }) =>
      api.addProject(input.name, { description: input.description, tone: input.tone }),
    onSuccess: (created) => {
      queryClient.setQueryData<Project[]>(hazyQueryKeys.note.projects(), (prev) =>
        prev ? [...prev, created] : [created]
      );
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.projects() });
    },
  });
}

export function useUpdateNoteProjectMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; description?: string | null; tone?: "accent" | "neutral" }) =>
      api.updateProject(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.project(id) });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.projects() });
    },
  });
}

export function useDeleteNoteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: (_res, id) => {
      queryClient.removeQueries({ queryKey: hazyQueryKeys.note.project(id) });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.projects() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.items() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.notes() });
    },
  });
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteCreateInput) => api.addNote(input),
    onSuccess: (created) => {
      queryClient.setQueryData(hazyQueryKeys.note.note(created.id), created);
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.notes() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.projects() });
      if (created.projectId) {
        void queryClient.invalidateQueries({
          queryKey: hazyQueryKeys.note.project(created.projectId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.tags() });
    },
  });
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onMutate: async (id) => {
      const key = hazyQueryKeys.note.notes();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Note[]>(key);
      if (previous) {
        queryClient.setQueryData<Note[]>(
          key,
          previous.filter((n) => n.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(hazyQueryKeys.note.notes(), ctx.previous);
      }
    },
    onSuccess: (_res, id) => {
      queryClient.removeQueries({ queryKey: hazyQueryKeys.note.note(id) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.notes() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.projects() });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.note.tags() });
      void queryClient.invalidateQueries({ queryKey: ["note", "analyze"] });
    },
  });
}

export function useRebuildAnalyzeMutation(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetProjectId?: string) => api.rebuildAnalyze(targetProjectId ?? projectId),
    onSuccess: (profile, targetProjectId) => {
      const resolvedProjectId = targetProjectId ?? projectId;
      queryClient.setQueryData(hazyQueryKeys.note.analyze(resolvedProjectId), profile);
    },
  });
}
