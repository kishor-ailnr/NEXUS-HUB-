import React, { useState } from 'react';
import { Bell, CheckCheck, ExternalLink, X, AlertTriangle, Info, BellRing } from 'lucide-react';
import { NotificationItem } from '@nexus-ways/shared';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

interface NotificationDrawerProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleMarkAsRead = async (id: string) => {
    setLoadingId(id);
    try {
      await onMarkAsRead(id);
      toast.success('Notification marked as read');
    } catch {
      toast.error('Failed to update notification');
    } finally {
      setLoadingId(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-status-critical" />;
      case 'system':
        return <BellRing className="w-4 h-4 text-amber-500" />;
      default:
        return <Info className="w-4 h-4 text-status-informational" />;
    }
  };

  return (
    <>
      {/* Bell Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="relative text-slate-600 hover:text-navy hover:bg-slate-100"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-status-critical text-[10px] font-bold text-white ring-2 ring-white animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Slide-over Drawer / Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-navy" />
                  <h2 className="text-lg font-bold text-slate-900">Notifications & Mail</h2>
                  {unreadCount > 0 && (
                    <Badge variant="warning" className="ml-1 text-xs">
                      {unreadCount} unread
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full text-slate-500 hover:text-slate-800"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold text-slate-600">No notifications yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      System messages and division alerts will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        item.readAt
                          ? 'bg-slate-50/60 border-slate-200 opacity-80'
                          : 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(item.type)}
                          <span className="font-bold text-sm text-slate-900">{item.title}</span>
                        </div>
                        {!item.readAt && (
                          <span className="w-2 h-2 rounded-full bg-status-informational flex-shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-3">{item.body}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        <div className="flex items-center gap-2">
                          {item.actionLabel && item.actionUrl && (
                            <a
                              href={item.actionUrl}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              <span>{item.actionLabel}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          {!item.readAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsRead(item.id)}
                              disabled={loadingId === item.id}
                              className="h-7 px-2 text-xs gap-1 border-slate-200 hover:bg-slate-100 text-slate-700"
                            >
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{loadingId === item.id ? 'Marking...' : 'Mark read'}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span>Realtime Push Active</span>
                <span>NEXUS WAYS &bull; Alert Dispatcher</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
