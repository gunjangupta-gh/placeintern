// ColumnSelector Component - Select columns for report
import React, { useState, useMemo } from "react";
import {
  Checkbox,
  Button,
  Space,
  Typography,
  Input,
  Tag,
  Tooltip,
  Empty,
} from "antd";
import {
  SearchOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  SortAscendingOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useDebounce } from "../../hooks/useDebounce";

const { Text } = Typography;
const { Search } = Input;

const ColumnSelector = ({
  columns = [],
  selectedColumns = [],
  onChange,
  disabled = false,
  maxColumns,
  showSort = true,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const searchTerm = useDebounce(searchInput, 300);

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    if (!searchTerm) return columns;
    const term = searchTerm.toLowerCase();
    return columns.filter(
      (col) =>
        col.label?.toLowerCase().includes(term) ||
        col.id?.toLowerCase().includes(term) ||
        col.description?.toLowerCase().includes(term)
    );
  }, [columns, searchTerm]);

  // Group columns by category if available
  const groupedColumns = useMemo(() => {
    const groups = {};
    filteredColumns.forEach((col) => {
      const group = col.group || "General";
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(col);
    });
    return groups;
  }, [filteredColumns]);

  const handleColumnToggle = (columnId) => {
    if (disabled) return;

    const isSelected = selectedColumns.includes(columnId);
    let newSelection;

    if (isSelected) {
      newSelection = selectedColumns.filter((id) => id !== columnId);
    } else {
      if (maxColumns && selectedColumns.length >= maxColumns) {
        return; // Max columns reached
      }
      newSelection = [...selectedColumns, columnId];
    }

    onChange?.(newSelection);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const allIds = filteredColumns.map((col) => col.id);
    const maxIds = maxColumns ? allIds.slice(0, maxColumns) : allIds;
    onChange?.(maxIds);
  };

  const handleDeselectAll = () => {
    if (disabled) return;
    onChange?.([]);
  };

  const handleMoveUp = (columnId) => {
    const index = selectedColumns.indexOf(columnId);
    if (index > 0) {
      const newSelection = [...selectedColumns];
      [newSelection[index - 1], newSelection[index]] = [
        newSelection[index],
        newSelection[index - 1],
      ];
      onChange?.(newSelection);
    }
  };

  const getColumnById = (id) => columns.find((col) => col.id === id);

  return (
    <div className="column-selector">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <Text strong>
            Selected: {selectedColumns.length}
            {maxColumns && ` / ${maxColumns}`}
          </Text>
          <Text type="secondary" className="ml-2">
            columns
          </Text>
        </div>
        <Space>
          <Button
            size="small"
            icon={<CheckSquareOutlined />}
            onClick={handleSelectAll}
            disabled={disabled}
          >
            All
          </Button>
          <Button
            size="small"
            icon={<BorderOutlined />}
            onClick={handleDeselectAll}
            disabled={disabled || selectedColumns.length === 0}
          >
            None
          </Button>
        </Space>
      </div>

      {/* Search */}
      <Search
        placeholder="Search columns..."
        allowClear
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="mb-4"
        prefix={<SearchOutlined className="text-gray-400" />}
        aria-label="Search columns"
      />

      {/* Selected columns preview with reorder */}
      {showSort && selectedColumns.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <Text strong className="block mb-2">
            <SortAscendingOutlined className="mr-2" />
            Column Order (drag to reorder)
          </Text>
          <div className="flex flex-wrap gap-2">
            {selectedColumns.map((colId, index) => {
              const col = getColumnById(colId);
              return (
                <Tag
                  key={colId}
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    handleColumnToggle(colId);
                  }}
                  className="flex items-center gap-1"
                >
                  <span className="text-gray-400 text-xs mr-1">
                    {index + 1}.
                  </span>
                  {col?.label || colId}
                  {index > 0 && (
                    <SwapOutlined
                      className="ml-1 cursor-pointer text-blue-500 hover:text-blue-700"
                      onClick={() => handleMoveUp(colId)}
                      style={{ transform: "rotate(90deg)", fontSize: 10 }}
                    />
                  )}
                </Tag>
              );
            })}
          </div>
        </div>
      )}

      {/* Column list */}
      <div className="max-h-80 overflow-y-auto border rounded-lg p-3">
        {Object.keys(groupedColumns).length === 0 ? (
          <Empty description="No columns found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          Object.entries(groupedColumns).map(([group, cols]) => (
            <div key={group} className="mb-4 last:mb-0">
              {Object.keys(groupedColumns).length > 1 && (
                <Text strong className="block mb-2 text-gray-600">
                  {group}
                </Text>
              )}
              <div className="space-y-2">
                {cols.map((col) => {
                  const isSelected = selectedColumns.includes(col.id);
                  const isDisabled =
                    disabled ||
                    (!isSelected &&
                      maxColumns &&
                      selectedColumns.length >= maxColumns);

                  return (
                    <div
                      key={col.id}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-disabled={isDisabled}
                      aria-label={`${col.label}${col.description ? `: ${col.description}` : ""}`}
                      tabIndex={isDisabled ? -1 : 0}
                      className={`
                        flex items-center p-2 rounded-lg transition-colors cursor-pointer
                        ${isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"}
                        ${isDisabled && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                      `}
                      onClick={() => !isDisabled && handleColumnToggle(col.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          !isDisabled && handleColumnToggle(col.id);
                        }
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        className="mr-3"
                        tabIndex={-1}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Text strong={isSelected}>{col.label}</Text>
                          {col.sortable && (
                            <Tooltip title="Sortable">
                              <SortAscendingOutlined className="text-gray-400 text-xs" />
                            </Tooltip>
                          )}
                        </div>
                        {col.description && (
                          <Text type="secondary" className="text-xs block truncate">
                            {col.description}
                          </Text>
                        )}
                      </div>
                      {col.type && (
                        <Tag className="ml-2 text-xs" color="default">
                          {col.type}
                        </Tag>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Max columns warning */}
      {maxColumns && selectedColumns.length >= maxColumns && (
        <Text type="warning" className="block mt-2 text-xs">
          Maximum {maxColumns} columns can be selected
        </Text>
      )}
    </div>
  );
};

export default ColumnSelector;