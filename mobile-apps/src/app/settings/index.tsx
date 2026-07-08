import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'

const SettingPage = () => {
  return (
    <View>

      <Link href="/settings/account">Security</Link>
      <Link href="/settings/history">Notifications</Link>
    </View>
  )
}

export default SettingPage

const styles = StyleSheet.create({})