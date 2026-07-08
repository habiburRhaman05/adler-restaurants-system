import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Redirect } from 'expo-router'

const HomePage = () => {
  return (
   <Redirect href="/(tabs)/schedule" />
  )
}

export default HomePage

const styles = StyleSheet.create({})