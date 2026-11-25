import { PageBody } from '../../../components/Screen';
import { PageTitle } from '../../../components/admin/ui';
import SettingsTabs from '../../../components/admin/SettingsTabs';
import CalendarSettings from '../../../components/admin/CalendarSettings';

// /admin/settings/holidays — weekly offs and company holidays.
export default function HolidaySettings() {
  return (
    <PageBody>
      <PageTitle label="SETTINGS" title="Holidays" subtitle="Weekly offs and company holidays." />
      <SettingsTabs />
      <CalendarSettings />
    </PageBody>
  );
}
