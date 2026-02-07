import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { fetchStudents } from "../../features/principal/store/principalSlice";

const MixedStudentChart = () => {
  const dispatch = useDispatch();
  const { list: students, loading } = useSelector((state) => state.principal.students);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await dispatch(fetchStudents()).unwrap();
      } catch (error) {
        console.error("Error fetching institute data:", error);
      }
    };

    fetchData();
  }, [dispatch]);

  useEffect(() => {
    if (students && students.length > 0) {
      const branchCounts = {};

      students.forEach((student) => {
        const branch = (student.user?.branchName || student.branchName)?.trim();
        if (branch) {
          branchCounts[branch] = (branchCounts[branch] || 0) + 1;
        }
      });

      // Convert to array format for Recharts
      const data = Object.entries(branchCounts).map(([branch, count]) => ({
        branch: branch,
        students: count,
      }));

      setChartData(data);
    }
  }, [students]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface p-3 shadow-lg rounded-xl border border-border">
          <p className="font-semibold text-text-primary mb-1">{label}</p>
          <p className="text-primary text-sm">
            Students: <span className="font-bold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Generate dynamic colors based on data length
  const getBarColor = (index) => {
    const colors = [
      "#8884d8",
      "#82ca9d",
      "#ffc658",
      "#ff7300",
      "#00ff00",
      "#0088fe",
      "#00C49F",
      "#FFBB28",
      "#FF8042",
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Loading chart...</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "400px" }}>
      {/* <h3 className="text-center text-lg font-semibold mb-4 text-gray-700">
        Total Student Count by Branch
      </h3> */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="branch"
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{
              value: "Number of Students",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="students" name="Student Count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MixedStudentChart;