import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1b1420]/40 backdrop-blur-sm p-4">
            <div
                className="glass-panel bg-white/80 backdrop-blur-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
                <div className="flex items-center justify-between p-5 border-b border-white/60">
                    <h2 className="panel-title">{title}</h2>
                    <button
                        onClick={onClose}
                        className="icon-action"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
