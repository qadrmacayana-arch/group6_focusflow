import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Task } from './task.service';

export interface CanvasCourse {
  id: string;
  name: string;
  code: string;
}

export interface CanvasSyncResult {
  success: boolean;
  coursesCount: number;
  courses: CanvasCourse[];
  assignments: Task[];
  studentName?: string;
  warning?: string;
  error?: string;
}

interface CanvasAssignmentResponse {
  id: string;
  title: string;
  courseCode: string;
  dueAt: string | null;
  duration: number;
  priority: Task['priority'];
  ticketId: string;
}

interface CanvasSyncResponse {
  success: boolean;
  courses: CanvasCourse[];
  assignments: CanvasAssignmentResponse[];
  student?: { name?: string };
  warning?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CanvasSyncService {
  constructor(private http: HttpClient) {}

  syncWithToken(domain: string, token: string): Observable<CanvasSyncResult> {
    const cleanDomain = (domain || 'canvas.tip.edu.ph')
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '');

    return this.http
      .post<CanvasSyncResponse>('/api/canvas/sync', {
        domain: cleanDomain,
        token: token.trim(),
      })
      .pipe(
        map((response) => {
          if (
            response.success !== true ||
            !Array.isArray(response.assignments) ||
            !Array.isArray(response.courses)
          ) {
            throw new Error(response.error || 'Canvas rejected access token');
          }

          const tasks = response.assignments.map((assignment) => {
            const dueDate = assignment.dueAt ? new Date(assignment.dueAt) : null;
            const validDueDate = dueDate && Number.isFinite(dueDate.getTime()) ? dueDate : null;
            return {
              id: assignment.id,
              title: `[${assignment.courseCode}] ${assignment.title}`,
              category: 'academic' as const,
              status: 'pending' as const,
              duration: assignment.duration,
              priority: assignment.priority,
              dueTime: validDueDate
                ? `${String(validDueDate.getHours()).padStart(2, '0')}:${String(validDueDate.getMinutes()).padStart(2, '0')}`
                : undefined,
              dueDate: validDueDate
                ? `${validDueDate.getFullYear()}-${String(validDueDate.getMonth() + 1).padStart(2, '0')}-${String(validDueDate.getDate()).padStart(2, '0')}`
                : 'Unscheduled',
              source: 'canvas' as const,
              sourceCourse: assignment.courseCode,
              ticketId: assignment.ticketId,
              subtasks: [],
            };
          });

          return {
            success: true,
            coursesCount: response.courses.length,
            courses: response.courses,
            assignments: tasks,
            studentName: response.student?.name || 'Canvas student',
            warning: response.warning,
          };
        }),
        catchError((error: unknown) => {
          const message =
            error instanceof HttpErrorResponse &&
            typeof error.error?.error === 'string'
              ? error.error.error
              : error instanceof Error
                ? error.message
                : 'Failed to authenticate token with Canvas';
          return of({
            success: false,
            coursesCount: 0,
            courses: [],
            assignments: [],
            error: message,
          });
        }),
      );
  }
}
