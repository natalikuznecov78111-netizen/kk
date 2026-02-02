
import React from 'react';

interface StatusBarProps {
  time: Date;
}

const StatusBar: React.FC<StatusBarProps> = () => {
  // 根据要求移除所有时间、电量及相关图标
  return (
    <div className="absolute top-0 left-0 right-0 h-7 z-[100] pointer-events-none">
      {/* 保持状态栏占位但内容为空 */}
    </div>
  );
};

export default StatusBar;