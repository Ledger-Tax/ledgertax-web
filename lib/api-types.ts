import type { components } from './api-schema';

/** Types generated from openapi/openapi.yaml (run `pnpm gen:api` after changing the spec). */
export type ApiEvent = components['schemas']['Event'];
export type EventType = components['schemas']['EventType'];
export type ApiLabel = components['schemas']['Label'];
export type LabelKind = ApiLabel['label'];
export type ReportRequest = components['schemas']['ReportRequest'];
export type ReportResponse = components['schemas']['ReportResponse'];
export type ApiErrorBody = components['schemas']['ErrorResponse'];
