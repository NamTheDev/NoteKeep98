import type {Note} from '../notes/data';

/** Versioned wire contracts. Server-side validation and authorization are separate. */
export const SYNC_PROTOCOL_VERSION=1;
export interface Mutation {
  operationId:string;
  noteId:string;
  baseRevision:number;
  value:Note|null;
}
export interface RevisionedNote {
  noteId:string;
  revision:number;
  value:Note|null;
}
export interface PendingMutation extends Mutation {
  base:Note|null;
  queuedAt:number;
}
export interface Conflict {
  operationId:string;
  noteId:string;
  base:Note|null;
  local:Note|null;
  remote:Note|null;
  fields:string[];
}
export type ClientMessage =
  | {type:'resume';version:1;since:number}
  | {type:'mutate';mutation:Mutation};
export type ServerMessage =
  | {type:'ack';operationId:string;workspaceRevision:number;note:RevisionedNote}
  | {type:'change';workspaceRevision:number;note:RevisionedNote}
  | {type:'snapshot';workspaceRevision:number;notes:RevisionedNote[]}
  | {type:'conflict';conflict:Conflict}
  | {type:'error';code:string;operationId?:string};
