import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Form, Select, Skeleton, Space, Tag, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CloseOutlined,
  DownOutlined,
  HolderOutlined,
  PlusOutlined,
  RightOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import FilterBuilder from '../../../components/report-builder/FilterBuilder';

const { Text } = Typography;

const panel = {
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 12,
  background: 'rgb(var(--color-background))',
};
const caps = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'rgb(var(--color-text-tertiary))',
};

const FORMAT_LABEL = { excel: 'Excel', csv: 'CSV', pdf: 'PDF', json: 'JSON' };

/** Left panel: report categories (collapsible) with their reports. */
const CatalogTree = ({ catalog, selectedType, onSelect, loading }) => {
  const [open, setOpen] = useState({});
  const categories = Object.entries(catalog);

  // open the category of the selected report, and the first one initially
  useEffect(() => {
    if (!categories.length) return;
    setOpen((prev) => {
      if (Object.keys(prev).length) return prev;
      return { [categories[0][0]]: true };
    });
  }, [categories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedType) return;
    const cat = categories.find(([, reports]) => reports.some((r) => r.type === selectedType))?.[0];
    if (cat) setOpen((prev) => (prev[cat] ? prev : { ...prev, [cat]: true }));
  }, [selectedType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ ...caps, marginBottom: 12 }}>Report catalogue</div>
      {loading && !categories.length ? (
        <Skeleton active paragraph={{ rows: 6 }} title={false} />
      ) : (
        categories.map(([category, reports]) => {
          const isOpen = !!open[category];
          const hasSelected = reports.some((r) => r.type === selectedType);
          return (
            <div key={category}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [category]: !p[category] }))}
                className="w-full flex items-center justify-between rounded-lg px-2 py-2 text-left"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: hasSelected ? 'rgb(var(--color-primary))' : 'inherit' }}
              >
                <span className="flex items-center gap-2" style={{ fontWeight: 500 }}>
                  {isOpen ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                  {category.replace(/ Reports$/, '')}
                </span>
                <span style={{ fontSize: 12, color: 'rgb(var(--color-text-tertiary))' }}>{reports.length}</span>
              </button>
              {isOpen && (
                <div style={{ marginLeft: 14, paddingLeft: 8, borderLeft: '1px solid rgb(var(--color-border))', marginBottom: 4 }}>
                  {reports.map((report) => {
                    const active = report.type === selectedType;
                    return (
                      <button
                        key={report.type}
                        type="button"
                        onClick={() => onSelect(report.type)}
                        className="w-full text-left rounded-lg px-3 py-2"
                        style={{
                          display: 'block',
                          border: 'none',
                          cursor: 'pointer',
                          background: active ? 'rgb(var(--color-primary) / 0.12)' : 'transparent',
                          color: active ? 'rgb(var(--color-primary))' : 'inherit',
                          fontWeight: active ? 500 : 400,
                        }}
                      >
                        {report.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

/** Selected columns (reorder / remove) and the optional ones to add. */
const ColumnsPanel = ({ available, selected, onChange }) => {
  const [dragFrom, setDragFrom] = useState(null);
  const byId = useMemo(() => new Map(available.map((c) => [c.id, c])), [available]);
  const optional = available.filter((c) => !selected.includes(c.id));

  const move = (from, to) => {
    if (to < 0 || to >= selected.length || from === to) return;
    const next = [...selected];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const iconBtn = (disabled) => ({
    border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? 'rgb(var(--color-border))' : 'rgb(var(--color-text-secondary))', padding: 4,
  });

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ ...caps, marginBottom: 12 }}>Columns ({selected.length})</div>

      {selected.length === 0 ? (
        <Text type="secondary">No columns selected. Add some from the optional columns below.</Text>
      ) : (
        <div className="flex flex-col gap-2" style={{ maxHeight: 5 * 42 + 4 * 8 + 2, overflowY: "auto", paddingRight: 4 }}>
          {selected.map((id, index) => (
            <div
              key={id}
              draggable
              onDragStart={() => setDragFrom(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragFrom !== null) move(dragFrom, index); setDragFrom(null); }}
              onDragEnd={() => setDragFrom(null)}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ border: '1px solid rgb(var(--color-border))', opacity: dragFrom === index ? 0.5 : 1, background: 'rgb(var(--color-background))' }}
            >
              <HolderOutlined style={{ cursor: 'grab', color: 'rgb(var(--color-text-tertiary))' }} />
              <span style={{ flex: 1, minWidth: 0 }}>{byId.get(id)?.label || id}</span>
              <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, index - 1)} style={iconBtn(index === 0)}>
                <ArrowUpOutlined />
              </button>
              <button type="button" aria-label="Move down" disabled={index === selected.length - 1} onClick={() => move(index, index + 1)} style={iconBtn(index === selected.length - 1)}>
                <ArrowDownOutlined />
              </button>
              <button type="button" aria-label="Remove column" onClick={() => onChange(selected.filter((c) => c !== id))} style={iconBtn(false)}>
                <CloseOutlined />
              </button>
            </div>
          ))}
        </div>
      )}

      {optional.length > 0 && (
        <>
          <div style={{ ...caps, fontSize: 11, margin: '18px 0 8px' }}>Optional columns</div>
          <div className="flex flex-wrap gap-2">
            {optional.map((col) => (
              <button
                key={col.id}
                type="button"
                title={col.description}
                onClick={() => onChange([...selected, col.id])}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1"
                style={{ border: '1px solid rgb(var(--color-border))', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
              >
                <PlusOutlined style={{ fontSize: 10 }} /> {col.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Builder tab: catalogue on the left; on the right the selected report with Generate, its columns,
 * and filters / sorting / saved templates.
 */
const ReportBuilderWorkspace = ({
  catalogByCategory, catalogLoading, configLoading,
  selectedType, onSelectType, currentReport,
  availableColumns, selectedColumns, setSelectedColumns,
  availableFilters, filterValues, setFilterValues,
  groupByOptions, groupBy, setGroupBy,
  sortableColumns, sortBy, setSortBy, sortOrder, setSortOrder,
  exportFormats, selectedFormat, setSelectedFormat,
  templates, onLoadTemplate, onDeleteTemplate, onSaveTemplate,
  generating, onGenerate,
}) => {
  const category = Object.entries(catalogByCategory).find(([, reports]) => reports.some((r) => r.type === selectedType))?.[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
      <CatalogTree catalog={catalogByCategory} selectedType={selectedType} onSelect={onSelectType} loading={catalogLoading} />

      <div className="flex flex-col gap-4" style={{ minWidth: 0 }}>
        {!selectedType ? (
          <div style={{ ...panel, padding: 48 }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a report from the catalogue to start" />
          </div>
        ) : (
          <>
            {/* Header: report name + actions */}
            <div style={{ ...panel, padding: '16px 20px' }} className="flex items-center justify-between flex-wrap gap-3">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'rgb(var(--color-text-secondary))' }}>{category?.replace(/ Reports$/, '')}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{currentReport?.name || selectedType}</div>
              </div>
              <Space wrap>
                <Select
                  value={selectedFormat}
                  onChange={setSelectedFormat}
                  style={{ width: 110 }}
                  options={exportFormats.map((f) => ({ value: f, label: FORMAT_LABEL[f] || f }))}
                />
                <Button icon={<SaveOutlined />} onClick={onSaveTemplate} disabled={selectedColumns.length === 0}>
                  Save template
                </Button>
                <Button
                  type="primary"
                  icon={<BarChartOutlined />}
                  loading={generating}
                  disabled={selectedColumns.length === 0}
                  onClick={onGenerate}
                >
                  Generate
                </Button>
              </Space>
            </div>

            {configLoading ? (
              <div style={{ ...panel, padding: 16 }}><Skeleton active paragraph={{ rows: 6 }} /></div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <ColumnsPanel available={availableColumns} selected={selectedColumns} onChange={setSelectedColumns} />

                <div className="flex flex-col gap-4" style={{ minWidth: 0 }}>
                  {availableFilters.length > 0 && (
                    <div style={{ ...panel, padding: 16 }}>
                      <div style={{ ...caps, marginBottom: 12 }}>Filters</div>
                      <FilterBuilder
                        filters={availableFilters}
                        reportType={selectedType}
                        values={filterValues}
                        onChange={setFilterValues}
                        compact={false}
                      />
                    </div>
                  )}

                  {(groupByOptions.length > 0 || sortableColumns.length > 0) && (
                    <div style={{ ...panel, padding: 16 }}>
                      <div style={{ ...caps, marginBottom: 12 }}>Grouping & sorting</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {groupByOptions.length > 0 && (
                          <Form.Item label="Group by" className="mb-0">
                            <Select
                              allowClear
                              placeholder="No grouping"
                              value={groupBy}
                              onChange={setGroupBy}
                              options={groupByOptions.map((o) => ({
                                value: o,
                                label: o.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
                              }))}
                            />
                          </Form.Item>
                        )}
                        {sortableColumns.length > 0 && (
                          <Form.Item label="Sort by" className="mb-0">
                            <Space.Compact style={{ width: '100%' }}>
                              <Select
                                allowClear
                                placeholder="Column"
                                value={sortBy}
                                onChange={setSortBy}
                                style={{ flex: 1 }}
                                options={sortableColumns.map((id) => ({ value: id, label: availableColumns.find((c) => c.id === id)?.label || id }))}
                              />
                              <Select
                                value={sortOrder}
                                onChange={setSortOrder}
                                style={{ width: 90 }}
                                options={[{ value: 'asc', label: 'Asc' }, { value: 'desc', label: 'Desc' }]}
                              />
                            </Space.Compact>
                          </Form.Item>
                        )}
                      </div>
                    </div>
                  )}

                  {templates.length > 0 && (
                    <div style={{ ...panel, padding: 16 }}>
                      <div style={{ ...caps, marginBottom: 12 }}>Saved templates</div>
                      <div className="flex flex-wrap gap-2">
                        {templates.map((t) => (
                          <Tag
                            key={t.id}
                            className="cursor-pointer"
                            closable
                            onClick={() => onLoadTemplate(t)}
                            onClose={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteTemplate(t.id); }}
                          >
                            {t.name}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportBuilderWorkspace;
