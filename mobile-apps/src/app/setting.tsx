import { Link } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const setting = () => {
  return (
    <SafeAreaView>
        <View>
      <Text>setting</Text>
      <Link href={'/'}>go to home</Link>
    </View>
    </SafeAreaView>
  )
}

export default setting

const styles = StyleSheet.create({})