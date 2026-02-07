import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { fetchStaff } from "../../features/principal/store/principalSlice";

const UserRolesPieChart = () => {
  const dispatch = useDispatch();
  const { list: users, loading } = useSelector((state) => state.principal.staff);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await dispatch(fetchStaff()).unwrap();
      } catch (error) {
        console.error("Error fetching institute data:", error);
      }
    };

    fetchData();
  }, [dispatch]);

  useEffect(() => {
    if (users && users.length > 0) {
      // Count roles except "STUDENT"
      const roleCounts = {};
      users.forEach((user) => {
        const role = user.role?.trim();
        if (role && role.toUpperCase() !== "STUDENT") {
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        }
      });

      // Convert to array format for Recharts
      const data = Object.entries(roleCounts).map(([role, count]) => ({
        name: role,
        value: count,
      }));

      setChartData(data);
    }
  }, [users]);

  // Colors for pie chart segments
  const COLORS = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#8e44ad",
    "#1abc9c",
    "#f39c12",
    "#e74c3c",
    "#2ecc71",
  ];

  // Custom label function
  const renderLabel = (entry) => {
    return `${entry.name}: ${entry.value}`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-surface p-3 shadow-lg rounded-xl border border-border">
          <p className="font-semibold text-text-primary mb-1">{data.payload.name}</p>
          <p className="text-primary text-sm">
            Count: <span className="font-bold">{data.value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Loading role chart...</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "400px" }}>
      {/* <h3 className="text-center text-lg font-semibold mb-4 text-gray-700">
        Users by Role (excluding STUDENTS)
      </h3> */}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="40%"
            labelLine={false}
            label={renderLabel}
            outerRadius={110}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {/* <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => (
              <span style={{ color: entry.color, fontWeight: 500 }}>
                {value}
              </span>
            )}
          /> */}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default UserRolesPieChart;