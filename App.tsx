import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, StatusBar,
  ScrollView, SafeAreaView
} from 'react-native';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
async function registerForPushNotifications() {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: '927f4ee4-b5cd-42f0-a9b9-b63774335e26'
  });
  return token.data;
}
const API = 'https://emp-management-api-4icz.onrender.com';
export default function App() {
  const [screen, setScreen] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [token, setToken] = useState('');
  const [salaries, setSalaries] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDate, setLeaveDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  React.useEffect(() => {
    const subscription1 = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });
    const subscription2 = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });
    return () => {
      subscription1.remove();
      subscription2.remove();
    };
  }, []);
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/employee/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        setEmployee(data.employee);
        setToken(data.token);
        setScreen('dashboard');
        try {
          const pushToken = await registerForPushNotifications();
          if (pushToken) {
            await fetch(`${API}/api/notifications/save-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ employeeId: data.employee._id, pushToken })
            });
          }
        } catch (pushError) {
          console.log('Push token error:', pushError);
        }
      } else {
        Alert.alert('Error', data.message || 'Login failed');
      }
    } catch (err) {
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };
  const handleCheckIn = async () => {
    setCheckLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Location permission is required');
        setCheckLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const res = await fetch(`${API}/api/attendance/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          employeeId: employee._id,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        })
      });
      const data = await res.json();
      Alert.alert(data.success ? 'Success ✅' : 'Failed ❌', data.message);
    } catch (err) {
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setCheckLoading(false);
    }
  };
  const handleCheckOut = async () => {
    setCheckLoading(true);
    try {
      const res = await fetch(`${API}/api/attendance/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ employeeId: employee._id })
      });
      const data = await res.json();
      Alert.alert(data.success ? 'Success ✅' : 'Failed ❌', data.message);
    } catch (err) {
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setCheckLoading(false);
    }
  };
  const fetchSalaries = async () => {
    try {
      const res = await fetch(`${API}/api/salary/${employee._id}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.success) setSalaries(data.salaries);
      setScreen('salary');
    } catch (err) {
      Alert.alert('Error', 'Cannot fetch salary');
    }
  };
  const handleLogout = () => {
    setEmployee(null);
    setToken('');
    setEmail('');
    setPassword('');
    setScreen('login');
  };
  const handleLeaveRequest = async () => {
    if (!leaveReason) {
      Alert.alert('Error', 'Please enter reason for leave');
      return;
    }
    setLeaveLoading(true);
    try {
      const dateString = leaveDate instanceof Date ? leaveDate.toISOString() : new Date(leaveDate).toISOString();
      const res = await fetch(`${API}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          employeeId: employee._id,
          leaveDate: dateString,
          reason: leaveReason
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Leave request submitted successfully!');
        setLeaveDate(new Date());
        setLeaveReason('');
        setScreen('dashboard');
      } else {
        Alert.alert('Error', data.message || 'Failed to submit');
      }
    } catch (err) {
      console.log('Leave error:', err);
      Alert.alert('Error', 'Cannot connect to server. Please try again.');
    } finally {
      setLeaveLoading(false);
    }
  };
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (screen === 'login') return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <View style={styles.header}>
        <Text style={styles.logo}>AICT</Text>
        <Text style={styles.subtitle}>Employee Management System</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Employee Login</Text>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#94a3b8"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          placeholderTextColor="#94a3b8"
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
  if (screen === 'leave') return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <View style={styles.header}>
        <Text style={styles.logo}>AICT</Text>
        <Text style={styles.subtitle}>Leave Request</Text>
      </View>
      <ScrollView>
        <View style={{ padding: 16 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('dashboard')}>
            <Text style={styles.backBtnText}>← Back to Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.card}>
            <Text style={styles.title}>Apply for Leave</Text>
            <Text style={styles.label}>Leave Date</Text>
            <TouchableOpacity
              style={[styles.input, { justifyContent: 'center' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: '#1e293b', fontSize: 15 }}>
                {leaveDate.toLocaleDateString('en-IN')}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={leaveDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setLeaveDate(selectedDate);
                }}
              />
            )}
            <Text style={styles.label}>Reason for Leave</Text>
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              value={leaveReason}
              onChangeText={setLeaveReason}
              placeholder="Enter reason for leave..."
              placeholderTextColor="#94a3b8"
              multiline
            />
            <TouchableOpacity
              style={[styles.btn, leaveLoading && styles.btnDisabled]}
              onPress={handleLeaveRequest}
              disabled={leaveLoading}
            >
              {leaveLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Submit Leave Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  if (screen === 'profile') return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <View style={styles.header}>
        <Text style={styles.logo}>AICT</Text>
        <Text style={styles.subtitle}>My Profile</Text>
      </View>
      <ScrollView>
        <View style={{ padding: 16 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('dashboard')}>
            <Text style={styles.backBtnText}>← Back to Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.card}>
            <View style={[styles.profileRow, { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}>
              <View style={[styles.avatar, { width: 70, height: 70, borderRadius: 35 }]}>
                <Text style={[styles.avatarText, { fontSize: 30 }]}>{employee?.name?.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={[styles.empName, { fontSize: 20 }]}>{employee?.name}</Text>
                <Text style={styles.empDesig}>{employee?.designation}</Text>
              </View>
            </View>
            <View style={styles.infoGrid}>
              {[
                { label: 'Employee ID', value: employee?.employeeId },
                { label: 'Department', value: employee?.department },
                { label: 'Email', value: employee?.email },
                { label: 'Phone', value: employee?.phone },
                { label: 'Basic Salary', value: '₹' + Number(employee?.basicSalary).toLocaleString('en-IN') },
                { label: 'Allowances', value: '₹' + Number(employee?.allowances).toLocaleString('en-IN') },
                { label: 'Deductions', value: '₹' + Number(employee?.deductions).toLocaleString('en-IN') },
                { label: 'Net Salary', value: '₹' + (Number(employee?.basicSalary) + Number(employee?.allowances) - Number(employee?.deductions)).toLocaleString('en-IN') },
                { label: 'Joining Date', value: new Date(employee?.joiningDate).toLocaleDateString('en-IN') },
                { label: 'Status', value: employee?.isActive ? 'Active' : 'Inactive' },
              ].map(({ label, value }) => (
                <View key={label} style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  if (screen === 'salary') return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <View style={styles.header}>
        <Text style={styles.logo}>AICT</Text>
        <Text style={styles.subtitle}>Salary Slips</Text>
      </View>
      <ScrollView>
        <View style={{ padding: 16 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('dashboard')}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          {salaries.length === 0 ? (
            <View style={styles.card}>
              <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 16 }}>No salary records found</Text>
            </View>
          ) : salaries.map((s: any) => (
            <View key={s._id} style={styles.salaryCard}>
              <View style={styles.salaryHeader}>
                <Text style={styles.salaryMonth}>{months[s.month - 1]} {s.year}</Text>
                <View style={[styles.badge, s.status === 'paid' ? styles.badgePaid : styles.badgePending]}>
                  <Text style={styles.badgeText}>{s.status === 'paid' ? '✅ Paid' : '⏳ Pending'}</Text>
                </View>
              </View>
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Basic Salary</Text>
                <Text style={styles.salaryValue}>₹{Number(s.basicSalary).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Allowances</Text>
                <Text style={[styles.salaryValue, { color: '#16a34a' }]}>+₹{Number(s.allowances).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Deductions</Text>
                <Text style={[styles.salaryValue, { color: '#dc2626' }]}>-₹{Number(s.deductions).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Days Worked</Text>
                <Text style={styles.salaryValue}>{s.totalDaysWorked} days</Text>
              </View>
              <View style={[styles.salaryRow, styles.netRow]}>
                <Text style={styles.netLabel}>Net Salary</Text>
                <Text style={styles.netValue}>₹{Number(s.netSalary).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <View style={styles.header}>
        <Text style={styles.logo}>AICT</Text>
        <Text style={styles.subtitle}>Employee Management System</Text>
      </View>
      <ScrollView>
        <View style={{ padding: 16 }}>
          {/* Profile */}
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{employee?.name?.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.empName}>{employee?.name}</Text>
                <Text style={styles.empDesig}>{employee?.designation} • {employee?.department}</Text>
              </View>
            </View>
          </View>
          {/* Attendance */}
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1 }]}>
            <Text style={styles.sectionTitle}>📅 Today's Attendance</Text>
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[styles.checkInBtn, checkLoading && styles.btnDisabled]}
                onPress={handleCheckIn}
                disabled={checkLoading}
              >
                {checkLoading ? <ActivityIndicator color="white" /> : <Text style={styles.checkBtnText}>Check In</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.checkOutBtn, checkLoading && styles.btnDisabled]}
                onPress={handleCheckOut}
                disabled={checkLoading}
              >
                {checkLoading ? <ActivityIndicator color="white" /> : <Text style={styles.checkBtnText}>Check Out</Text>}
              </TouchableOpacity>
            </View>
          </View>
          {/* Quick Actions */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionBtn} onPress={fetchSalaries}>
                <Text style={styles.actionIcon}>💰</Text>
                <Text style={styles.actionText}>Salary Slips</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setScreen('profile')}>
                <Text style={styles.actionIcon}>👤</Text>
                <Text style={styles.actionText}>My Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setScreen('leave')}>
                <Text style={styles.actionIcon}>📝</Text>
                <Text style={styles.actionText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#1e3a8a', padding: 40, alignItems: 'center', paddingBottom: 30 },
  logo: { fontSize: 36, fontWeight: '800', color: 'white', letterSpacing: 2 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: 16 },
  btn: { backgroundColor: '#1d4ed8', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#1d4ed8' },
  empName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  empDesig: { fontSize: 13, color: '#64748b', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  attendanceButtons: { flexDirection: 'row', gap: 12 },
  checkInBtn: { flex: 1, backgroundColor: '#16a34a', borderRadius: 12, padding: 14, alignItems: 'center' },
  checkOutBtn: { flex: 1, backgroundColor: '#dc2626', borderRadius: 12, padding: 14, alignItems: 'center' },
  checkBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  actionGrid: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  logoutBtn: { backgroundColor: '#fff1f2', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecdd3', marginBottom: 32 },
  logoutText: { color: '#e11d48', fontWeight: '700', fontSize: 15 },
  backBtn: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10, marginBottom: 16, alignSelf: 'flex-start' },
  backBtnText: { color: '#475569', fontWeight: '600' },
  salaryCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  salaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  salaryMonth: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgePaid: { backgroundColor: '#f0fdf4' },
  badgePending: { backgroundColor: '#fffbeb' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  salaryLabel: { fontSize: 14, color: '#64748b' },
  salaryValue: { fontSize: 14, fontWeight: '600', color: '#334155' },
  netRow: { borderBottomWidth: 0, marginTop: 8 },
  netLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  netValue: { fontSize: 18, fontWeight: '800', color: '#16a34a' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoCard: { width: '47%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
});
