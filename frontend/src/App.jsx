import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Dashboard from './admin/Dashboard';
import UserManagement from './admin/UserManagement';
import Masterlist from './admin/MasterList';
import Schedule from './admin/Schedule';
import Notifications from './admin/Notification';
import Profile from './admin/Profile';

import BHWLayout from './components/BhwLayout';
import BHWDashboard from './bhw/Dashboard';
import BHWSchedule from './bhw/Schedule';
import BHWNeedAttention from './bhw/NeedAttention';
import BHWReferrals from './bhw/Refferals';
import BHWMedicalRecords from './bhw/MedicalRecords';
import BHWNotifications from './bhw/Notification';
import BHWProfile from './bhw/Profile';




function App() {
  return(
    <BrowserRouter>
    <Routes>
      <Route path ="/" element ={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />


      <Route path="/admin" element ={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout />
        </ProtectedRoute>
      }>

       
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="masterlist" element={<Masterlist/>} />
        <Route path="schedule" element={<Schedule/>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile/>} />

      </Route>


 
<Route
  path="/bhw"
  element={
    <ProtectedRoute allowedRoles={['bhw', 'bns']}>
      <BHWLayout />
    </ProtectedRoute>
  }
>
  

  <Route path="dashboard" element={<BHWDashboard />} />
  <Route path="need-attention" element={<BHWNeedAttention/>} />
  <Route path="referrals" element={<BHWReferrals/>} />
  <Route path="medical-records" element={<BHWMedicalRecords/>} />
  <Route path="schedule" element={<BHWSchedule/>} />
  <Route path="notifications" element={<BHWNotifications/>} />
  <Route path="profile" element={<BHWProfile/>} />
</Route>
       
    </Routes>


    
    </BrowserRouter>
  )
}

export default App;