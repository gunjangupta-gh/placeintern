import React, { useState } from 'react';
import { Button, Tabs, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import OpportunityUpload from './OpportunityUpload';
import OpportunityTable from './OpportunityTable';
import ApplicationsReview from './ApplicationsReview';
import OpportunityEditModal from './OpportunityEditModal';
import OpportunityStats from './OpportunityStats';

const { Title } = Typography;

/** State Directorate: publish internship opportunities (form or Excel), manage them, review applications. */
const StateOpportunities = () => {
  const [tab, setTab] = useState('opportunities');
  const [refreshKey, setRefreshKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Internship Opportunities</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>Add opportunity</Button>
      </div>
      <OpportunityStats refreshKey={refreshKey} />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        destroyOnHidden
        items={[
          { key: 'opportunities', label: 'Opportunities', children: <OpportunityTable refreshKey={refreshKey} onChanged={bump} /> },
          { key: 'applications', label: 'Applications', children: <ApplicationsReview refreshKey={refreshKey} onChanged={bump} /> },
          {
            key: 'upload',
            label: 'Upload from Excel',
            children: <OpportunityUpload onImported={() => { bump(); setTab('opportunities'); }} />,
          },
        ]}
      />
      {adding && (
        <OpportunityEditModal
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); setTab('opportunities'); bump(); }}
        />
      )}
    </div>
  );
};

export default StateOpportunities;
