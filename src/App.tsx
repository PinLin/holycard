import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CardReaderScreen } from './screens/CardReaderScreen';

function App(): React.JSX.Element {
    return (
        <SafeAreaProvider>
            <CardReaderScreen />
        </SafeAreaProvider>
    );
}

export default App;
