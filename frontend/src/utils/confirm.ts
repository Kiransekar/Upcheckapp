import { Alert } from 'react-native';

/**
 * A yes/no dialog as a promise, so a save path can `await` it inline instead of
 * splitting itself across an `onPress` callback.
 *
 * Dismissing the dialog — Android's back button, a tap outside — resolves
 * `false` like Cancel does. Without `onDismiss` the promise would never settle
 * and the caller's save would hang forever with no way back.
 */
export const confirm = (o: {
    title: string;
    message?: string;
    confirmLabel: string;
    cancelLabel: string;
    destructive?: boolean;
}): Promise<boolean> =>
    new Promise<boolean>((resolve) =>
        Alert.alert(
            o.title,
            o.message,
            [
                { text: o.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
                {
                    text: o.confirmLabel,
                    style: o.destructive ? 'destructive' : 'default',
                    onPress: () => resolve(true),
                },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
        ),
    );
