import { useCallback, useState } from 'react';
import ISetupPageProps from './ISetupPageProps';
import { Button } from '@jtl-software/platform-ui-react';
import { apiUrl } from '../../common/constants';

const SetupPage: React.FC<ISetupPageProps> = ({ appBridge }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupCompleted = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const sessionToken = await appBridge.method.call('getSessionToken');
      // call your backend to verify the session token and extract the payload
      const response = await fetch(`${apiUrl}/connect-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken,
        }),
      });

      const responseBody = await response.text();
      console.log('Response from backend:', response.status, responseBody);

      // handle the response from your backend
      if (response.ok) {
        await appBridge.method.call('setupCompleted');
      }
    } catch (error) {
      console.error('An error occurred during setup:', error);
    } finally {
      setIsLoading(false);
    }
  }, [appBridge]);

  if (isLoading) {
    return (
      <div>
        <h1>Loading...</h1>
        <p>Please wait while we are setting up your app</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Setup</h1>
      <p>Here could a login flow be performed and finally you can ask for confirmation to connect</p>
      <Button onClick={handleSetupCompleted} label="Setup App" />
    </div>
  );
};

export default SetupPage;
