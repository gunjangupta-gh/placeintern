import React, { useCallback, useEffect, useState } from 'react';
import { Button, InputNumber, Select, Spin, Tag, theme } from 'antd';
import { toast } from 'react-hot-toast';

export const SEMESTER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPEARED', label: 'Appeared' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
];

export const SEMESTER_STATUS_COLOR = {
  PENDING: 'default',
  APPEARED: 'processing',
  PASSED: 'success',
  FAILED: 'error',
};

const errorMessage = (error) =>
  error?.response?.data?.message?.toString?.() || error?.message || 'Failed to update semester status';

/**
 * Semester-wise result status for one student (Sem 1..current semester).
 * `service` is principalService or facultyService: both expose
 * getStudentSemesterStatus(studentId) and setStudentSemesterStatus(studentId, semester, data).
 * Each row saves on its own, since the backend validates one semester at a time.
 */
const SemesterStatusEditor = ({ studentId, service, onChanged }) => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingSem, setSavingSem] = useState(null);
  const [totalBacklogs, setTotalBacklogs] = useState(0);

  const applyResult = useCallback((result) => {
    setRows(result?.semesters || []);
    setTotalBacklogs(result?.totalBacklogs ?? 0);
    setDrafts({});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    service
      .getStudentSemesterStatus(studentId)
      .then((result) => !cancelled && applyResult(result))
      .catch((error) => !cancelled && toast.error(errorMessage(error)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [studentId, service, applyResult]);

  const updateDraft = (semester, patch) =>
    setDrafts((prev) => ({ ...prev, [semester]: { ...(prev[semester] || {}), ...patch } }));

  const save = async (row) => {
    const draft = { status: row.status, backlogCount: row.backlogCount, ...(drafts[row.semester] || {}) };
    setSavingSem(row.semester);
    try {
      const result = await service.setStudentSemesterStatus(studentId, row.semester, {
        status: draft.status,
        backlogCount: draft.status === 'FAILED' ? draft.backlogCount : undefined,
      });
      applyResult(result);
      toast.success(`Semester ${row.semester} updated`);
      onChanged?.(result);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingSem(null);
    }
  };

  if (loading) {
    return <Spin size="small" />;
  }

  if (!rows.length) {
    return (
      <div style={{ color: token.colorTextSecondary, fontSize: 13 }}>
        Semester status can be recorded once the student's current semester is set.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => {
          const draft = drafts[row.semester] || {};
          const status = draft.status ?? row.status;
          const backlogCount = draft.backlogCount ?? row.backlogCount;
          const dirty = status !== row.status || (status === 'FAILED' && backlogCount !== row.backlogCount);
          return (
            <div key={row.semester} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 90, fontWeight: 500 }}>Semester {row.semester}</span>
              <Select
                value={status}
                style={{ width: 150 }}
                disabled={!row.editable}
                options={SEMESTER_STATUS_OPTIONS}
                onChange={(value) =>
                  updateDraft(row.semester, {
                    status: value,
                    backlogCount: value === 'FAILED' ? Math.max(backlogCount || 0, 1) : 0,
                  })
                }
              />
              {status === 'FAILED' && (
                <InputNumber
                  min={1}
                  value={backlogCount}
                  disabled={!row.editable}
                  addonAfter="backlog(s)"
                  style={{ width: 150 }}
                  onChange={(value) => updateDraft(row.semester, { backlogCount: value })}
                />
              )}
              <Button
                type="primary"
                size="small"
                disabled={!row.editable || !dirty}
                loading={savingSem === row.semester}
                onClick={() => save(row)}
              >
                Save
              </Button>
              {!row.editable && <Tag>Not started</Tag>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextSecondary }}>
        Total backlogs: <strong>{totalBacklogs}</strong>. Overall clearance can be set to Cleared only after all earlier
        semesters are Passed.
      </div>
    </div>
  );
};

export default SemesterStatusEditor;
