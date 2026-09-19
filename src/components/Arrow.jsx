import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';
import { useI18n } from '../i18n/I18nProvider';

/** Arrow that points in the reading direction of the current language. */
export default function Arrow(props) {
  const { dir } = useI18n();
  const Icon = dir === 'rtl' ? LuArrowLeft : LuArrowRight;
  return <Icon aria-hidden="true" {...props} />;
}
