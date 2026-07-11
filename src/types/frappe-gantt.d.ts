// frappe-gantt não publica tipos oficiais; declaração mínima do que usamos.
declare module 'frappe-gantt' {
    export type GanttTask = {
        id: string;
        name: string;
        start: string;
        end: string;
        progress?: number;
        dependencies?: string;
        custom_class?: string;
        color?: string;
        color_progress?: string;
    };

    export type GanttOptions = {
        view_mode?: string;
        view_mode_select?: boolean;
        language?: string;
        readonly?: boolean;
        readonly_dates?: boolean;
        readonly_progress?: boolean;
        infinite_padding?: boolean;
        container_height?: number | 'auto';
        today_button?: boolean;
        popup_on?: 'click' | 'hover';
        lines?: 'both' | 'vertical' | 'horizontal' | 'none';
        on_click?: (task: GanttTask) => void;
        on_date_change?: (task: GanttTask, start: Date, end: Date) => void;
        on_progress_change?: (task: GanttTask, progress: number) => void;
    };

    export default class Gantt {
        constructor(wrapper: string | HTMLElement, tasks: GanttTask[], options?: GanttOptions);
        change_view_mode(mode: string): void;
        update_options(options: GanttOptions): void;
        refresh(tasks: GanttTask[]): void;
    }
}

declare module 'frappe-gantt/dist/frappe-gantt.css';
