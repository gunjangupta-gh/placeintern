# Common UI kit (antd based)

One place for the tables, modals, drawers and small pieces every page uses, so pages look and behave the same.
Everything here **wraps antd and passes all antd props through**, so swapping an antd component for its wrapper
never changes behaviour.

```js
import { AppTable, AppModal, AppDrawer, StatusTag } from '../../components/ui';
```

| Component | Replaces | Adds |
|---|---|---|
| `AppTable` | antd `Table` | `serial` (S.No, off by default), `actions` (icon-only row actions), default scroll / rowKey / pagination / empty state |
| `RowActions` | hand-built action buttons | icon buttons + tooltip, `hidden` / `disabled` / `confirm`, `render` escape hatch |
| `AppModal` | antd `Modal` | `description`, `size` (sm / md / lg / xl). Statics (`confirm`, `useModal`...) kept |
| `ConfirmModal` | ad-hoc yes / no modals | one confirmation layout |
| `ActionModal` | modal + remarks / form + submit | title, confirm label, loading, disabled |
| `AppDrawer`, `DrawerSection` | antd `Drawer` | `subtitle`, titled sections |
| `StatusTag` | `<Tag color={MAP[status]}>` | one status -> colour map and label |
| `Section` | `<Card>` around a page block | plain heading + actions (+ `bordered`) |
| `EmptyState`, `SearchBox`, `TitleCell` | | the standard empty / search / two-line cell |

## Row actions (PIMS style)

```jsx
<AppTable
  columns={columns}
  dataSource={rows}
  actions={[
    { key: 'view', label: 'View', icon: <EyeOutlined />, onClick: (r) => open(r) },
    { key: 'edit', label: 'Edit', icon: <EditOutlined />, onClick: edit, hidden: (r) => r.locked },
    { key: 'del', label: 'Delete', icon: <DeleteOutlined />, danger: true, onClick: remove,
      confirm: { title: 'Delete this record?', description: 'This cannot be undone.' } },
    { key: 'more', render: (r) => <Dropdown ...>...</Dropdown> },   // anything custom
  ]}
/>
```

## Rules

- Keep every existing prop when swapping. Do not change behaviour while migrating a page.
- S.No is opt-in: `serial`. Use it on long lists, not on small tables inside modals.
- Row actions are icon-only with a tooltip. Put the verb in `label`.
- New pages use this kit; the antd originals stay available for special cases.
