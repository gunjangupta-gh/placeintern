import React, { useState } from 'react';
import { Tabs, Typography } from 'antd';
import OpportunityUpload from './OpportunityUpload';
import OpportunityTable from './OpportunityTable';
import ApplicationsReview from './ApplicationsReview';

const { Title } = Typography;

/** State Directorate: publish internship opportunities (Excel), manage them, review applications. */
const StateOpportunities = () => {
  const [tab, setTab] = useState('opportunities');
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 16 }}>Internship Opportunities</Title>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        destroyOnHidden
        items={[
          { key: 'opportunities', label: 'Opportunities', children: <OpportunityTable refreshKey={refreshKey} /> },
          { key: 'applications', label: 'Applications', children: <ApplicationsReview refreshKey={refreshKey} onChanged={bump} /> },
          {
            key: 'upload',
            label: 'Upload from Excel',
            children: <OpportunityUpload onImported={() => { bump(); setTab('opportunities'); }} />,
          },
        ]}
      />
    </div>
  );
};

export default StateOpportunities;
