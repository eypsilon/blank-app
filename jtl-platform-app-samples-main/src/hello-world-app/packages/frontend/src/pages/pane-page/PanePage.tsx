import { Button, Input, Stack, Text } from '@jtl-software/platform-ui-react';
import { useState, useEffect, useCallback } from 'react';
import IPanePageProps from './IPanePageProps';

const PanePage: React.FC<IPanePageProps> = ({ appBridge }) => {
  const [customer, setCustomer] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = appBridge.event.subscribe('CustomerChanged', (data: unknown) => {
      return new Promise<void>(resolve => {
        setCustomer((data as { customerId: string }).customerId);
        resolve();
      });
    });

    return () => {
      unsubscribe();
    };
  }, [appBridge]);

  const handleGetCurrentCustomer = useCallback(() => {
    appBridge.method.call('getCurrentCustomerId').then(customerId => {
      setCustomer(customerId as string);
    });
  }, [appBridge]);

  return (
    <Stack spacing="4" direction="column">
      <Text align="center" type="h2">
        PANE APP
      </Text>
      <Input disabled value={customer} />
      <Button variant="outline" onClick={handleGetCurrentCustomer} label="Get Current Customer" />
    </Stack>
  );
};

export default PanePage;
