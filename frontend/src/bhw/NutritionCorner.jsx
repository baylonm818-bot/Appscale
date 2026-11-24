import { useAuth } from '../components/AuthContext';
import NutritionCornerView from '../components/NutritionCornerView';

export default function BHWNutritionCorner() {
  const { user } = useAuth();
  return <NutritionCornerView role="bhw" userBarangay={user?.barangay} />;
}
