import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Tag,
  Input,
  Row,
  Col,
  Popconfirm,
  Dropdown,
  Segmented,
  Tooltip,
  Flex,
  Typography,
  Alert,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  UserAddOutlined,
  SearchOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  DownOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  EditOutlined,
  SwapOutlined,
  BankOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import {
  fetchStaff,
  fetchStudents,
  assignMentor,
  fetchMentorAssignments,
  fetchMentorStats,
  removeMentorAssignment,
  bulkUnassignMentors,
  autoAssignMentors,
  fetchPrincipalDashboard,
} from '../store/principalSlice';
import {
  selectStaff,
  selectStudents,
  selectMentorAssignments,
  selectMentorStats,
  selectMentorStatsLoading,
} from '../store/principalSelectors';
import { debounce } from 'lodash';
import { useBatches, useBranches } from '../../shared/hooks/useLookup';

const { Text } = Typography;

const MentorAssignment = () => {
  const dispatch = useDispatch();
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [newMentorId, setNewMentorId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    hasMentor: '',
    batchId: '',
    branchId: '',
    mentorId: '',
    isActive: 'true', // Default to showing only active students
  });

  // Use memoized selectors from principalSelectors for better performance
  const staff = useSelector(selectStaff);
  const students = useSelector(selectStudents);
  const mentorAssignments = useSelector(selectMentorAssignments);
  const mentorStats = { data: useSelector(selectMentorStats), loading: useSelector(selectMentorStatsLoading) };
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // Use global lookup data for batches and branches
  const { activeBatches } = useBatches();
  const { activeBranches } = useBranches();

  useEffect(() => {
    dispatch(fetchStaff({ limit: 100 }));
    dispatch(fetchMentorAssignments());
    dispatch(fetchMentorStats());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchStudents(filters));
  }, [dispatch, filters]);

  const mentors = useMemo(() => {
    return (
      staff?.list?.filter(
        (s) =>
          s.role === 'TEACHER' ||
          s.role === 'mentor' ||
          s.role === 'faculty'
      ) || []
    );
  }, [staff?.list]);

  // Create a map of student IDs to their mentor assignments
  const studentMentorMap = useMemo(() => {
    const map = new Map();
    mentorAssignments?.forEach((a) => {
      map.set(a.studentId, a);
    });
    return map;
  }, [mentorAssignments]);

  // Create a set of student IDs that have mentors assigned
  const studentsWithMentors = useMemo(() => {
    return new Set(mentorAssignments?.map((a) => a.studentId) || []);
  }, [mentorAssignments]);

  // Get unique batches for filter
  const batchFilters = useMemo(() => {
    return activeBatches.map((b) => ({ text: b.name, value: b.id }));
  }, [activeBatches]);

  // Get unique departments/branches for filter from global lookup
  const departmentFilters = useMemo(() => {
    return activeBranches.map((b) => ({ text: b.name, value: b.id }));
  }, [activeBranches]);

  // Get unique mentors for filter from mentor assignments
  const mentorFilters = useMemo(() => {
    const mentorSet = new Map();
    mentorAssignments?.forEach((a) => {
      if (a.mentor?.id && a.mentor?.name) {
        mentorSet.set(a.mentor.id, a.mentor.name);
      }
    });
    return [
      { text: 'Not Assigned', value: 'none' },
      ...Array.from(mentorSet).map(([id, name]) => ({ text: name, value: id })),
    ];
  }, [mentorAssignments]);


  // Handle filter change - server-side filtering
  const handleFilterChange = useCallback((value) => {
    setAssignmentFilter(value);
    let hasMentor = '';
    if (value === 'assigned') hasMentor = 'true';
    else if (value === 'unassigned') hasMentor = 'false';
    setFilters((prev) => ({ ...prev, page: 1, hasMentor }));
  }, []);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setFilters((prev) => ({ ...prev, page: 1, search: value }));
    }, 300),
    []
  );

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleTableChange = (pagination, tableFilters, sorter) => {
    // Check if filters changed (not just pagination)
    const newBatchId = tableFilters.batch?.[0] || '';
    const newBranchId = tableFilters.department?.[0] || '';
    const newMentorIdFilter = tableFilters.mentor?.[0] || '';
    const filtersChanged =
      newBatchId !== filters.batchId ||
      newBranchId !== filters.branchId ||
      newMentorIdFilter !== filters.mentorId;

    setFilters((prev) => ({
      ...prev,
      // Reset to page 1 if filters changed, otherwise use current page
      page: filtersChanged ? 1 : pagination.current,
      limit: pagination.pageSize,
      batchId: newBatchId,
      branchId: newBranchId,
      mentorId: newMentorIdFilter,
    }));
  };

  const handleAssign = async () => {
    if (!selectedMentor || selectedStudents.length === 0) {
      toast.warning('Please select mentor and at least one student');
      return;
    }

    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const academicYear =
      month >= 6
        ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}`
        : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    setLoading(true);
    try {
      await dispatch(
        assignMentor({
          mentorId: selectedMentor,
          studentIds: selectedStudents,
          academicYear,
        })
      ).unwrap();

      toast.success(`Successfully assigned ${selectedStudents.length} student(s) to mentor`);
      setAssignModalVisible(false);
      setSelectedStudents([]);
      setSelectedMentor(null);
      form.resetFields();
      // Mentor assignments are updated optimistically in the slice
      // Only refresh stats that need recalculation
      dispatch(fetchMentorStats({ forceRefresh: true }));
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      toast.error(error?.message || 'Failed to assign mentor');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (studentId) => {
    try {
      await dispatch(removeMentorAssignment({ studentId })).unwrap();
      toast.success('Mentor assignment removed');
      // Mentor assignments are updated optimistically in the slice
      // Only refresh stats that need recalculation
      dispatch(fetchMentorStats({ forceRefresh: true }));
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      toast.error(error?.message || 'Failed to remove assignment');
    }
  };

  const handleEditClick = (record) => {
    const assignment = studentMentorMap.get(record.id);
    setEditingStudent({
      ...record,
      currentMentorId: assignment?.mentor?.id,
      currentMentorName: assignment?.mentor?.name,
    });
    setNewMentorId(assignment?.mentor?.id || null);
    editForm.setFieldsValue({
      mentorId: assignment?.mentor?.id,
    });
    setEditModalVisible(true);
  };

  const handleChangeMentor = async () => {
    if (!editingStudent || !newMentorId) {
      toast.warning('Please select a mentor');
      return;
    }

    if (newMentorId === editingStudent.currentMentorId) {
      toast.info('No changes made - same mentor selected');
      setEditModalVisible(false);
      return;
    }

    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const academicYear =
      month >= 6
        ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}`
        : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    setLoading(true);
    try {
      await dispatch(
        assignMentor({
          mentorId: newMentorId,
          studentIds: [editingStudent.id],
          academicYear,
          reason: 'Mentor reassignment',
        })
      ).unwrap();

      toast.success('Mentor changed successfully');
      setEditModalVisible(false);
      setEditingStudent(null);
      setNewMentorId(null);
      editForm.resetFields();
      // Mentor assignments are updated optimistically in the slice
      // Only refresh stats that need recalculation
      dispatch(fetchMentorStats({ forceRefresh: true }));
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      toast.error(error?.message || 'Failed to change mentor');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedStudents.length === 0) {
      toast.warning('Please select students to unassign');
      return;
    }

    const studentsToUnassign = selectedStudents.filter((id) => studentsWithMentors.has(id));
    if (studentsToUnassign.length === 0) {
      toast.warning('No selected students have mentors assigned');
      return;
    }

    setLoading(true);
    try {
      await dispatch(bulkUnassignMentors({ studentIds: studentsToUnassign })).unwrap();
      toast.success(`Removed mentor assignments from ${studentsToUnassign.length} student(s)`);
      setSelectedStudents([]);
      // Mentor assignments are updated optimistically in the slice
      // Only refresh stats that need recalculation
      dispatch(fetchMentorStats({ forceRefresh: true }));
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      toast.error(error?.message || 'Failed to bulk unassign');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    setLoading(true);
    try {
      const result = await dispatch(autoAssignMentors()).unwrap();
      toast.success(result.message || 'Auto-assignment completed');
      // Only refresh mentor assignments and stats - student data doesn't change
      dispatch(fetchMentorAssignments({ forceRefresh: true }));
      dispatch(fetchMentorStats({ forceRefresh: true }));
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      toast.error(error?.message || 'Failed to auto-assign');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    // Refresh all data on manual refresh
    dispatch(fetchMentorAssignments({ forceRefresh: true }));
    dispatch(fetchMentorStats({ forceRefresh: true }));
    dispatch(fetchStudents({ ...filters, forceRefresh: true }));
    dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
  };

  const rowSelection = {
    selectedRowKeys: selectedStudents,
    onChange: (selectedRowKeys) => {
      setSelectedStudents(selectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  const studentColumns = [
    {
      title: 'Roll Number',
      key: 'rollNumber',
      width: 130,
      sorter: (a, b) => {
        const rollA = a.user?.rollNumber || a.rollNumber || '';
        const rollB = b.user?.rollNumber || b.rollNumber || '';
        return rollA.localeCompare(rollB);
      },
      sortDirections: ['ascend', 'descend'],
      render: (_, record) => record.user?.rollNumber || record.rollNumber || 'N/A',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => {
        const nameA = a.user?.name || a.name || '';
        const nameB = b.user?.name || b.name || '';
        return nameA.localeCompare(nameB);
      },
      sortDirections: ['ascend', 'descend'],
      render: (text, record) => record.user?.name || text || 'N/A',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      filters: departmentFilters,
      filteredValue: filters.branchId ? [filters.branchId] : null,
      filterMode: 'menu',
      filterSearch: true,
      render: (_, record) => record.branch?.name || record.department?.name || 'N/A',
    },
    {
      title: 'Batch',
      dataIndex: 'batch',
      key: 'batch',
      filters: batchFilters,
      filteredValue: filters.batchId ? [filters.batchId] : null,
      filterMode: 'menu',
      filterSearch: true,
      render: (_, record) => record.batch?.name || record.batchId || 'N/A',
    },
    {
      title: 'Current Mentor',
      key: 'mentor',
      filters: mentorFilters,
      filteredValue: filters.mentorId ? [filters.mentorId] : null,
      filterMode: 'menu',
      filterSearch: true,
      render: (_, record) => {
        const assignment = studentMentorMap.get(record.id);
        if (!assignment) {
          return <Tag color="default">Not Assigned</Tag>;
        }
        const isExternal = assignment.isCrossInstitution;
        return (
          <div className="flex items-center gap-1.5">
            <Tag color={isExternal ? 'purple' : 'blue'} className="m-0">
              {assignment.mentor?.name || assignment.mentor?.user?.name}
            </Tag>
            {isExternal && (
              <Tooltip title={`External mentor from: ${assignment.mentor?.Institution?.name || 'Other Institution'}`}>
                <GlobalOutlined className="text-purple-500 text-xs" />
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const hasAssignment = studentsWithMentors.has(record.id);
        return (
          <Space size="small">
            {hasAssignment ? (
              <>
                <Tooltip title="Change Mentor">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleEditClick(record)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Remove mentor assignment?"
                  description="This will unassign the mentor from this student."
                  onConfirm={() => handleRemoveAssignment(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Tooltip title="Remove Mentor">
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                  </Tooltip>
                </Popconfirm>
              </>
            ) : (
              <Tooltip title="Assign Mentor">
                <Button
                  type="text"
                  icon={<UserAddOutlined />}
                  size="small"
                  onClick={() => {
                    setSelectedStudents([record.id]);
                    setAssignModalVisible(true);
                  }}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const assignmentColumns = [
    {
      title: 'Mentor Name',
      dataIndex: ['mentor', 'name'],
      key: 'mentorName',
      sorter: (a, b) => (a.mentor?.name || '').localeCompare(b.mentor?.name || ''),
      render: (_, record) => {
        const isExternal = record.isCrossInstitution;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">{record.mentor?.name}</span>
            {isExternal && (
              <Tooltip title={`From: ${record.mentor?.Institution?.name || 'Other Institution'}`}>
                <Tag color="purple" className="m-0 text-[10px] px-1.5 border-0">
                  <GlobalOutlined className="mr-1" />
                  External
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: 'Institution',
      key: 'institution',
      render: (_, record) => {
        if (record.isCrossInstitution && record.mentor?.Institution) {
          return (
            <Tooltip title={record.mentor.Institution.name}>
              <div className="text-xs text-purple-600">
                <BankOutlined className="mr-1" />
                {record.mentor.Institution.code || record.mentor.Institution.name}
              </div>
            </Tooltip>
          );
        }
        return <Text className="text-xs text-text-tertiary">This Institution</Text>;
      },
    },
    {
      title: 'Email',
      dataIndex: ['mentor', 'email'],
      key: 'email',
      render: (text) => <Text className="text-xs text-text-secondary">{text}</Text>,
    },
    {
      title: 'Total Students',
      key: 'studentCount',
      sorter: (a, b) => {
        const countA = mentorAssignments?.filter((ma) => ma.mentorId === a.mentor?.id).length || 0;
        const countB = mentorAssignments?.filter((ma) => ma.mentorId === b.mentor?.id).length || 0;
        return countA - countB;
      },
      defaultSortOrder: 'descend',
      render: (_, record) => {
        const count = mentorAssignments?.filter((a) => a.mentorId === record.mentor?.id).length || 0;
        return <Tag color={count > 15 ? 'red' : count > 10 ? 'orange' : 'green'}>{count}</Tag>;
      },
    },
    {
      title: 'Students',
      key: 'students',
      render: (_, record) => {
        const assignedStudents =
          mentorAssignments?.filter((a) => a.mentorId === record.mentor?.id) || [];
        return (
          <Flex wrap="wrap" gap={4}>
            {assignedStudents.slice(0, 3).map((a) => (
              <Tag key={a.id}>{a.student?.user?.name || a.student?.name || a.student?.user?.rollNumber || a.student?.rollNumber}</Tag>
            ))}
            {assignedStudents.length > 3 && <Tag>+{assignedStudents.length - 3} more</Tag>}
          </Flex>
        );
      },
    },
  ];

  const uniqueMentorAssignments = useMemo(() => {
    return (
      mentorAssignments?.reduce((acc, curr) => {
        if (curr.mentor && !acc.find((item) => item.mentor?.id === curr.mentor?.id)) {
          acc.push(curr);
        }
        return acc;
      }, []) || []
    );
  }, [mentorAssignments]);

  const stats = mentorStats?.data;

  // Bulk action menu items for Ant Design 5+
  const bulkMenuItems = [
    {
      key: 'assign',
      label: 'Assign Mentor',
      icon: <UserAddOutlined />,
      disabled: selectedStudents.length === 0,
    },
    {
      key: 'unassign',
      label: 'Unassign Selected',
      icon: <DeleteOutlined />,
      danger: true,
      disabled:
        selectedStudents.length === 0 ||
        !selectedStudents.some((id) => studentsWithMentors.has(id)),
    },
  ];

  const handleBulkMenuClick = ({ key }) => {
    if (key === 'assign') {
      setAssignModalVisible(true);
    } else if (key === 'unassign') {
      handleBulkUnassign();
    }
  };

  // Small Stat Card Component
  const StatCard = ({ title, value, secondaryValue, subtitle, icon, iconBgColor, iconColor, valueColor, tooltip }) => {
    const cardContent = (
      <Card
        className="h-full border-border shadow-soft hover:shadow-soft-lg transition-all duration-300 rounded-xl bg-surface"
        styles={{ body: { padding: '16px 12px' } }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            // className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${iconBgColor}`}
          >
            {React.cloneElement(icon, {
              className: `text-xl ${iconColor}`,
            })}
          </div>
          <Text className="text-xs font-medium text-text-secondary mb-1">{title}</Text>
          <div className="flex items-baseline justify-center gap-1">
            <span
              className={`text-3xl font-bold leading-none ${valueColor}`}
            >
              {value}
            </span>
            {secondaryValue !== undefined && (
              <>
                <span className="text-text-tertiary opacity-40 font-medium" style={{ fontSize: '16px' }}>/</span>
                <span className="text-text-tertiary font-semibold" style={{ fontSize: '16px' }}>
                  {secondaryValue}
                </span>
              </>
            )}
          </div>
          {subtitle && (
            <Text className="text-[10px] text-text-tertiary mt-1">{subtitle}</Text>
          )}
        </div>
      </Card>
    );

    return tooltip ? <Tooltip title={tooltip}>{cardContent}</Tooltip> : cardContent;
  };

  const statCards = [
    {
      title: 'Total Mentors',
      value: stats?.mentors?.total || 0,
      subtitle: 'All mentor profiles',
      icon: <TeamOutlined />,
      iconBgColor: 'bg-info-light',
      iconColor: '',
      valueColor: 'text-info',
    },
    {
      title: 'Active Mentors',
      value: stats?.mentors?.assigned || 0,
      secondaryValue: stats?.mentors?.total || 0,
      subtitle: 'Currently assigned',
      icon: <CheckCircleOutlined />,
      iconBgColor: 'bg-success-light',
      iconColor: '',
      valueColor: 'text-success',
    },
    {
      title: 'External Mentors',
      value: stats?.mentors?.external || 0,
      subtitle: 'From other institutions',
      icon: <GlobalOutlined />,
      iconBgColor: 'bg-warning-light',
      iconColor: '',
      valueColor: stats?.mentors?.external > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-text-tertiary',
      tooltip: 'Mentors from other institutions assigned to your students',
    },
    {
      title: 'Students with Mentor',
      value: stats?.students?.withMentor || 0,
      secondaryValue: stats?.students?.total || 0,
      subtitle: 'Mentor assigned',
      icon: <UserOutlined />,
      iconBgColor: 'bg-success-light',
      iconColor: '',
      valueColor: 'text-success',
    },
    {
      title: 'Unassigned Students',
      value: stats?.students?.withoutMentor || 0,
      subtitle: 'Awaiting assignment',
      icon: <WarningOutlined />,
      iconBgColor: 'bg-error-light',
      iconColor: '',
      valueColor: stats?.students?.withoutMentor > 0 ? 'text-error' : 'text-success',
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen space-y-6">
      {/* Statistics Cards */}
      {/* <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </div> */}

      {/* External Mentoring Alert - Our faculty mentoring students from other institutions */}
      {stats?.externalMentoring?.externalStudentsCount > 0 && (
        <Alert
          message={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GlobalOutlined className="text-purple-600" />
                <span className="font-semibold">External Mentoring Active</span>
              </div>
              <Tag color="purple" className="m-0 text-sm px-3 py-0.5">
                {stats.externalMentoring.ourMentorsWithExternalAssignments} Faculty • {stats.externalMentoring.externalStudentsCount} External Students
              </Tag>
            </div>
          }
          description={
            <div className="mt-2">
              <Text className="text-xs text-gray-600 block mb-2">
                Your faculty are mentoring students from other institutions:
              </Text>
              <div className="flex flex-wrap gap-2">
                {stats.externalMentoring.externalInstitutions?.map((inst) => (
                  <Tag key={inst.id} className="m-0" color="purple">
                    <BankOutlined className="mr-1" />
                    {inst.name}
                  </Tag>
                ))}
              </div>
            </div>
          }
          type="info"
          className="rounded-xl border-purple-200 bg-purple-50"
          showIcon={false}
        />
      )}

      <Card
        title={<span className="text-text-primary font-semibold">Mentor Assignment</span>}
        extra={
          <Space>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} className="rounded-lg" />
            </Tooltip>
            {stats?.students?.withoutMentor > 0 && (
              <Popconfirm
                title="Auto-assign mentors?"
                description={`This will distribute ${stats.students.withoutMentor} unassigned student(s) evenly among available mentors.`}
                onConfirm={handleAutoAssign}
                okText="Yes, Auto-assign"
                cancelText="Cancel"
              >
                <Button icon={<ThunderboltOutlined />} loading={loading} className="rounded-lg">
                  Auto-Assign ({stats.students.withoutMentor})
                </Button>
              </Popconfirm>
            )}
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setAssignModalVisible(true)}
              className="rounded-lg shadow-md shadow-primary/20"
            >
              Assign Mentor
            </Button>
          </Space>
        }
        className="rounded-2xl shadow-soft border-border bg-surface overflow-hidden"
      >
        <div className="mb-8">
          <h3 className="text-xs uppercase tracking-widest text-text-tertiary font-bold mb-4 flex items-center gap-2">
            <TeamOutlined />
            Current Mentor Assignments
          </h3>
          <div className="bg-surface rounded-xl border-border shadow-soft overflow-hidden">
            <Table
              columns={assignmentColumns}
              dataSource={uniqueMentorAssignments}
              rowKey={(record) => record.mentor?.id || record.id}
              pagination={{ pageSize: 5 }}
              size="small"
              className="custom-table-small"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-6 pb-2 ">
            <h3 className="text-xs uppercase tracking-widest text-text-tertiary font-bold m-0 flex items-center gap-2">
              <UserOutlined />
              All Students
            </h3>
            <Segmented
              options={[
                { label: 'All', value: 'all' },
                { label: 'Assigned', value: 'assigned' },
                { label: 'Unassigned', value: 'unassigned' },
              ]}
              value={assignmentFilter}
              onChange={handleFilterChange}
              className="rounded-lg p-1 bg-background-tertiary"
            />
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <Input
              placeholder="Search students by name or roll number..."
              prefix={<SearchOutlined className="text-text-tertiary" />}
              value={searchText}
              onChange={handleSearchChange}
              className="w-full md:w-[320px] rounded-lg h-10"
              allowClear
            />
            <div className="flex items-center gap-3">
              {selectedStudents.length > 0 && (
                <Tag color="blue" className="px-3 py-0.5 rounded-full font-medium m-0">
                  {selectedStudents.length} selected
                </Tag>
              )}
              <Dropdown
                menu={{
                  items: bulkMenuItems,
                  onClick: handleBulkMenuClick,
                }}
                disabled={selectedStudents.length === 0}
                placement="bottomRight"
                trigger={['click']}
              >
                <Button disabled={selectedStudents.length === 0} className="rounded-lg h-10 px-6">
                  <Space>
                    Bulk Actions
                    <DownOutlined className="text-xs" />
                  </Space>
                </Button>
              </Dropdown>
            </div>
          </div>

          <div className="bg-surface rounded-xl border-border shadow-soft overflow-hidden">
            <Table
              rowSelection={rowSelection}
              columns={studentColumns}
              dataSource={students?.list || []}
              rowKey="id"
              loading={students?.loading}
              onChange={handleTableChange}
              pagination={{
                current: filters.page,
                pageSize: filters.limit,
                total: students?.pagination?.total || 0,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              scroll={{ x: 'max-content' }}
              size="middle"
              className="custom-table"
            />
          </div>
        </div>
      </Card>

      {/* Assign Modal */}
      <Modal
        title={
          <Space className="text-primary">
            <UserAddOutlined className="text-xl" />
            <span className="font-semibold text-lg">Assign Mentor to Students</span>
          </Space>
        }
        open={assignModalVisible}
        onOk={handleAssign}
        onCancel={() => {
          setAssignModalVisible(false);
          setSelectedStudents([]);
          setSelectedMentor(null);
          form.resetFields();
        }}
        width={800}
        confirmLoading={loading}
        okText="Assign"
        className="rounded-2xl overflow-hidden"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            label="Select Mentor"
            name="mentorId"
            rules={[{ required: true, message: 'Please select a mentor' }]}
          >
            <Select
              placeholder="Search and select a mentor"
              onChange={(value) => setSelectedMentor(value)}
              showSearch
              size="large"
              className="rounded-lg"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              options={mentors.map((mentor) => {
                const assignedCount =
                  mentorAssignments?.filter((a) => a.mentorId === mentor.id).length || 0;
                return {
                  value: mentor.id,
                  label: `${mentor.name} (${mentor.employeeId || mentor.email}) - ${assignedCount} students`,
                };
              })}
            />
          </Form.Item>

          <Form.Item label="Selected Students" className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <TeamOutlined className="text-text-tertiary" />
              <Text className="text-text-secondary font-medium">
                {selectedStudents.length} student(s) selected for assignment
              </Text>
            </div>
            <div className="rounded-xl border  overflow-hidden">
              <Table
                rowSelection={rowSelection}
                columns={[
                  {
                    title: 'Roll Number',
                    key: 'rollNumber',
                    render: (_, record) => (
                      <Text className="font-medium text-text-primary">
                        {record.user?.rollNumber || record.rollNumber || 'N/A'}
                      </Text>
                    ),
                  },
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text, record) => <Text className="text-text-primary">{record.user?.name || text || 'N/A'}</Text>,
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    render: (_, record) =>
                      studentsWithMentors.has(record.id) ? (
                        <Tag color="blue" className="rounded-md m-0">Has Mentor</Tag>
                      ) : (
                        <Tag className="rounded-md m-0 bg-background-tertiary text-text-tertiary border-0">No Mentor</Tag>
                      ),
                  },
                ]}
                dataSource={students?.list || []}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
                className="custom-table-small"
              />
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Mentor Modal */}
      <Modal
        title={
          <Space className="text-primary">
            <SwapOutlined className="text-xl" />
            <span className="font-semibold text-lg">Change Mentor</span>
          </Space>
        }
        open={editModalVisible}
        onOk={handleChangeMentor}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingStudent(null);
          setNewMentorId(null);
          editForm.resetFields();
        }}
        confirmLoading={loading}
        okText="Change Mentor"
        width={500}
        className="rounded-2xl overflow-hidden"
      >
        {editingStudent && (
          <Form form={editForm} layout="vertical" className="mt-4">
            <div className="mb-6 p-5 bg-background-tertiary/50 rounded-2xl border border-border/50">
              <Row gutter={16}>
                <Col span={12}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Student</Text>
                  <Text strong className="text-text-primary block text-base leading-tight">
                    {editingStudent.user?.name || editingStudent.name}
                  </Text>
                  <Text className="text-text-tertiary text-xs">{editingStudent.rollNumber}</Text>
                </Col>
                <Col span={12}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Current Mentor</Text>
                  <Text strong className="text-primary block text-base leading-tight">
                    {editingStudent.currentMentorName || 'Not Assigned'}
                  </Text>
                </Col>
              </Row>
            </div>

            <Form.Item
              label="Select New Mentor"
              name="mentorId"
              rules={[{ required: true, message: 'Please select a mentor' }]}
            >
              <Select
                placeholder="Search and select a mentor"
                onChange={(value) => setNewMentorId(value)}
                showSearch
                size="large"
                className="rounded-lg"
                filterOption={(input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
                }
                options={mentors.map((mentor) => {
                  const assignedCount =
                    mentorAssignments?.filter((a) => a.mentorId === mentor.id).length || 0;
                  const isCurrent = mentor.id === editingStudent.currentMentorId;
                  return {
                    value: mentor.id,
                    label: `${mentor.name} (${assignedCount} students)${isCurrent ? ' - Current' : ''}`,
                    disabled: isCurrent,
                  };
                })}
              />
            </Form.Item>

            {newMentorId && newMentorId !== editingStudent.currentMentorId && (
              <Alert
                title="Mentor Reassignment"
                description={`This will reassign the student from ${editingStudent.currentMentorName} to the selected mentor.`}
                type="info"
                showIcon
                className="mt-4 rounded-xl border-primary/20 bg-primary-50/50"
              />
            )}
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default MentorAssignment;

