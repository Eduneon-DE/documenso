import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';

export type WrappedTabItem = {
  label: string;
  value: string;
  icon?: ReactElement;
  component: ReactNode;
  disabled?: boolean;
};

export type WrappedTabsProps = {
  tabs: WrappedTabItem[];
  defaultValue?: string;
  orientation?: 'horizontal' | 'vertical';
  onChange?: (value: string) => void;
};

export const WrappedTabs = (props: WrappedTabsProps) => {
  const { tabs, defaultValue, orientation = 'vertical', onChange } = props;

  const [value, setValue] = useState(defaultValue || tabs[0]?.value || '');

  const handleTabClick = (tabValue: string) => {
    setValue(tabValue);
    onChange?.(tabValue);
  };

  const activeTab = tabs.find((tab) => tab.value === value);

  return (
    <div
      style={{
        flexGrow: 1,
        backgroundColor: '#ffffff',
        display: 'flex',
        height: '100%',
        flexDirection: orientation === 'vertical' ? 'row' : 'column',
      }}
    >
      {/* Tab Navigation */}
      <div
        style={{
          backgroundColor: '#FAFAFA',
          borderRight: orientation === 'vertical' ? '1px solid #EBE9F1' : 'none',
          borderBottom: orientation === 'horizontal' ? '1px solid #EBE9F1' : 'none',
          paddingTop: '8px',
          paddingBottom: '8px',
          width: orientation === 'vertical' ? '200px' : '100%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: orientation === 'vertical' ? 'column' : 'row',
          gap: '4px',
        }}
      >
        {tabs.map((tab) => {
          const isSelected = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => !tab.disabled && handleTabClick(tab.value)}
              disabled={tab.disabled}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px',
                margin: '4px 8px',
                borderRadius: '8px',
                border: 'none',
                background: isSelected ? '#EAF0FC' : 'transparent',
                color: isSelected ? '#4a86e8' : '#5E5873',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                opacity: tab.disabled ? 0.5 : 1,
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: 400,
                fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                minHeight: '40px',
                width: orientation === 'vertical' ? 'calc(100% - 16px)' : 'auto',
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !tab.disabled) {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected && !tab.disabled) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {tab.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Tab Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#ffffff',
          padding: '24px',
          minHeight: 0,
        }}
      >
        {activeTab?.component}
      </div>
    </div>
  );
};

export default WrappedTabs;
