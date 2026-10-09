import { Component } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '../ui/Text'
import { colors } from '../../theme'

// App-level error boundary: a screen crash shows "something went wrong / retry" instead of a blank screen.
export class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.desc}>An unexpected error occurred. Please try again.</Text>
        <Pressable onPress={() => this.setState({ failed: false })} style={styles.btn}>
          <Text style={styles.btnText}>Retry</Text>
        </Pressable>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.slate[50] },
  title: { fontSize: 18, fontWeight: '700', color: colors.slate[900] },
  desc: { marginTop: 8, fontSize: 14, textAlign: 'center', color: colors.ink.subtle },
  btn: { marginTop: 20, height: 40, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand[600] },
  btnText: { fontSize: 14, fontWeight: '500', color: '#fff' },
})
