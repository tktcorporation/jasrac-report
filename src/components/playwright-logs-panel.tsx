import { useState, useEffect, useRef } from "react";
import { Terminal, ChevronUp, ChevronDown } from "lucide-react";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "./ui/collapsible";

interface PlaywrightLogsPanelProps {
  logs: string[];
  isPolling: boolean;
  showLogs: boolean;
  onCancel: () => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function PlaywrightLogsPanel({
  logs,
  isPolling,
  showLogs,
  onCancel,
  onRefresh,
  onClose
}: PlaywrightLogsPanelProps) {
  // ログの折りたたみ状態を管理
  const [isOpen, setIsOpen] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // プロセスが完了しているかチェックする（最新のログをチェック）
  const isProcessCompleted = () => {
    if (logs.length === 0) return false;

    // 最後の5つのログメッセージをチェック
    const lastLogs = logs.slice(-5);
    const completionKeywords = [
      "完了しました",
      "処理が終了",
      "検索完了",
      "終了コード 0",
    ];

    return lastLogs.some((log) =>
      completionKeywords.some((keyword) => log.includes(keyword))
    );
  };

  // ログが更新されたら自動スクロール
  useEffect(() => {
    if (logsContainerRef.current && logs.length > 0) {
      const container = logsContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  // プロセスが完了したときにログを折りたたむ
  useEffect(() => {
    if (isProcessCompleted()) {
      setIsOpen(false);
    }
  }, [logs]);

  if (!showLogs) return null;

  return (
    <div className="mb-6 bg-slate-900 text-slate-100 p-4 rounded-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex items-center hover:text-blue-400">
              {isOpen ? 
                <ChevronUp className="h-4 w-4 mr-2" /> : 
                <ChevronDown className="h-4 w-4 mr-2" />
              }
              <Terminal className="h-4 w-4" />
              <h3 className="font-medium ml-2">Playwright実行ログ</h3>
            </CollapsibleTrigger>
            
            {isPolling && (
              <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full ml-2">
                自動更新中
              </span>
            )}
            {isProcessCompleted() && (
              <span className="text-xs bg-green-600 px-2 py-0.5 rounded-full ml-2">
                完了
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPolling && (
              <button
                onClick={onCancel}
                className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
              >
                キャンセル
              </button>
            )}
            <button
              onClick={onRefresh}
              className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded mr-2"
            >
              更新
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100"
            >
              ×
            </button>
          </div>
        </div>
        
        <CollapsibleContent>
          <div
            className="h-48 overflow-y-auto p-2 bg-slate-950 rounded"
            ref={logsContainerRef}
          >
            {logs.length > 0 ? (
              <ul className="space-y-1 font-mono text-sm">
                {logs.map((log, index) => (
                  <li key={index} className="break-all">
                    {log}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 italic">ログはまだありません。</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
} 