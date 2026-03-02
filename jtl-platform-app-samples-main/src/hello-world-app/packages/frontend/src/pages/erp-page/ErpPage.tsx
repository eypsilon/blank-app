import { useCallback, useState } from 'react';
import IErpPageProps from './IErpPageProps';

const ErpPage: React.FC<IErpPageProps> = ({ appBridge }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const view = new URLSearchParams(window.location.search).get('view');
  const handleRequestTimestampPress = useCallback(async (): Promise<void> => {
    try {
      setIsRequesting(true);
      appBridge.method.expose('getCurrentTime', () => new Date());
      const time = await appBridge.method.call<Date>('getCurrentTime');
      setTime(`${typeof time} ${time.toUTCString()}`);
    } finally {
      setIsRequesting(false);
    }
  }, [appBridge]);

  return (
    <div>
      <h1>{`ERP ${view}`}</h1>
      <p>Demo goes here:</p>
      <button onClick={handleRequestTimestampPress}>Request time now</button>
      {isRequesting && <p>Requesting...</p>}
      <h1>{time}</h1>
    </div>
  );
};

export default ErpPage;
