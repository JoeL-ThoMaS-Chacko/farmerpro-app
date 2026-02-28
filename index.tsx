import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location"; // ← replaces @react-native-community/geolocation
import { router } from "expo-router";
import { Edit3, FileText, Home, Leaf, MapPin, User } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const KERALA_DISTRICTS = [
  { name: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366, rainfall: 538 },
  { name: "Kollam", lat: 8.5432, lon: 76.3841, rainfall: 424 },
  { name: "Pathanamthitta", lat: 9.2648, lon: 76.787, rainfall: 518 },
  { name: "Alappuzha", lat: 9.4981, lon: 76.3388, rainfall: 464.3 },
  { name: "Kottayam", lat: 9.5916, lon: 76.5222, rainfall: 549.6 },
  { name: "Idukki", lat: 9.9189, lon: 77.1025, rainfall: 413.4 },
  { name: "Ernakulam", lat: 10.0, lon: 76.1555, rainfall: 466.4 },
  { name: "Thrissur", lat: 10.5276, lon: 76.2144, rainfall: 371.5 },
  { name: "Palakkad", lat: 10.7867, lon: 76.6548, rainfall: 281.4 },
  { name: "Malappuram", lat: 11.051, lon: 76.0711, rainfall: 306.4 },
  { name: "Kozhikode", lat: 11.1588, lon: 75.4904, rainfall: 347.4 },
  { name: "Wayanad", lat: 11.6854, lon: 76.132, rainfall: 253.5 },
  { name: "Kannur", lat: 11.5245, lon: 75.2504, rainfall: 311.4 },
  { name: "Kasaragod", lat: 12.4996, lon: 75.0077, rainfall: 304.5 },
];

const KERALA_RAINFALL_DATA: { [key: string]: number } = {
  Thiruvananthapuram: 538,
  Kollam: 424,
  Pathanamthitta: 518,
  Alappuzha: 464.3,
  Kottayam: 549.6,
  Idukki: 413.4,
  Ernakulam: 466.4,
  Thrissur: 371.5,
  Palakkad: 281.4,
  Malappuram: 306.4,
  Kozhikode: 347.4,
  Wayanad: 253.5,
  Kannur: 311.4,
  Kasaragod: 304.5,
};

interface LocationData {
  lat: number;
  lon: number;
  district: string;
  state: string;
  isManual?: boolean;
}
interface WeatherData {
  temp: number;
  humidity: number;
  rainfall: number;
  condition: string;
  description: string;
}

export default function HomeScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [userData, setUserData] = useState<{ name?: string } | null>(null);
  const locationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initializeLocation();
    loadUserData();
    return () => {
      if (locationTimeoutRef.current) clearTimeout(locationTimeoutRef.current);
    };
  }, []);

  const loadUserData = async () => {
    try {
      const data = await AsyncStorage.getItem("userData");
      if (data) setUserData(JSON.parse(data));
    } catch (_) {}
  };

  const setDefaultLocation = async () => {
    const d = KERALA_DISTRICTS.find((x) => x.name === "Idukki")!;
    const loc: LocationData = {
      lat: d.lat,
      lon: d.lon,
      district: d.name,
      state: "Kerala",
      isManual: true,
    };
    await AsyncStorage.setItem("userLocation", JSON.stringify(loc));
    setLocation(loc);
    setLocationLoading(false);
    fetchWeatherData(loc);
  };

  const initializeLocation = async () => {
    try {
      locationTimeoutRef.current = setTimeout(setDefaultLocation, 15000);

      const stored = await AsyncStorage.getItem("userLocation");
      if (stored) {
        const loc = JSON.parse(stored);
        setLocation(loc);
        setLocationLoading(false);
        fetchWeatherData(loc);
        if (locationTimeoutRef.current)
          clearTimeout(locationTimeoutRef.current);
      } else {
        await requestLocationPermission();
      }
    } catch {
      setDefaultLocation();
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        getCurrentLocation();
      } else {
        setDefaultLocation();
      }
    } catch {
      setDefaultLocation();
    }
  };

  const getCurrentLocation = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (locationTimeoutRef.current) clearTimeout(locationTimeoutRef.current);
      await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setDefaultLocation();
    }
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      );
      const data = await res.json();
      const loc: LocationData = {
        lat,
        lon,
        district:
          data.address.county || data.address.state_district || "Unknown",
        state: data.address.state || "Kerala",
      };
      await AsyncStorage.setItem("userLocation", JSON.stringify(loc));
      setLocation(loc);
      setLocationLoading(false);
      fetchWeatherData(loc);
    } catch {
      setDefaultLocation();
    }
  };

  const selectManualLocation = async (d: (typeof KERALA_DISTRICTS)[0]) => {
    const loc: LocationData = {
      lat: d.lat,
      lon: d.lon,
      district: d.name,
      state: "Kerala",
      isManual: true,
    };
    await AsyncStorage.setItem("userLocation", JSON.stringify(loc));
    setLocation(loc);
    setShowLocationModal(false);
    fetchWeatherData(loc);
  };

  const fetchWeatherData = async (loc: LocationData) => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=118abeee9772432cbf6102936250912&q=${loc.lat},${loc.lon}&aqi=no`,
      );
      const data = await res.json();
      setWeather({
        temp: Math.round(data.current.temp_c),
        humidity: data.current.humidity,
        rainfall: KERALA_RAINFALL_DATA[loc.district] || 2500,
        condition: data.current.condition.text,
        description: data.current.condition.text.toLowerCase(),
      });
    } catch {
      setWeather({
        temp: 28,
        humidity: 75,
        rainfall: KERALA_RAINFALL_DATA[loc.district] || 2500,
        condition: "Clear",
        description: "clear sky",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWeatherEmoji = (c: string) =>
    ({
      Clear: "☀️",
      Clouds: "☁️",
      Rain: "🌧️",
      Drizzle: "🌦️",
      Thunderstorm: "⛈️",
      Snow: "❄️",
      Mist: "🌫️",
      Fog: "🌫️",
    })[c] || "🌤️";


  const handleCropPrediction = () => {
    if (!weather || !location) {
      Alert.alert("Please Wait", "Weather data is still loading.");
      return;
    }
    router.push({
      pathname: "/croppred",
      params: {
        temperature: weather.temp,
        humidity: weather.humidity,
        rainfall: weather.rainfall,
        district: location.district,
      },
    });
  };


  const LocationCard = () => (
    <View style={styles.locationCard}>
      {locationLoading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.locationLoadingText}>
            Getting your location...
          </Text>
        </View>
      ) : location ? (
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <MapPin color="#4CAF50" size={20} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.locationDistrict}>{location.district}</Text>
              <Text style={styles.locationState}>
                {location.state}
                {location.isManual && " (Manual)"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowLocationModal(true)}
            style={{ padding: 8 }}
          >
            <Edit3 color="#4CAF50" size={18} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.row}
          onPress={() => setShowLocationModal(true)}
        >
          <MapPin color="#4CAF50" size={20} />
          <Text style={styles.locationButtonText}>Select Location</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const WeatherCard = () => (
    <View style={styles.weatherCard}>
      {loading || locationLoading ? (
        <View style={[styles.row, { justifyContent: "center", padding: 20 }]}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.locationLoadingText, { marginTop: 10 }]}>
            Loading weather data...
          </Text>
        </View>
      ) : weather ? (
        <>
          <View style={styles.weatherHeader}>
            <Text style={styles.weatherEmoji}>
              {getWeatherEmoji(weather.condition)}
            </Text>
            <View style={styles.weatherInfo}>
              <Text style={styles.temperature}>{weather.temp}°C</Text>
              <Text style={styles.weatherDesc}>{weather.description}</Text>
            </View>
          </View>
          <View style={styles.weatherDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Humidity</Text>
              <Text style={styles.detailValue}>{weather.humidity}%</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Annual Rainfall</Text>
              <Text style={styles.detailValue}>{weather.rainfall} mm</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.errorText}>Unable to load weather</Text>
      )}
    </View>
  );

  const FeatureCard = ({ icon, title, description, onPress }: any) => (
    <TouchableOpacity style={styles.featureCard} onPress={onPress}>
      <View style={styles.featureIcon}>{icon}</View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{description}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>AgriSmart</Text>
            <Text style={styles.headerSubtitle}>
              {userData?.name
                ? `Welcome, ${userData.name}`
                : "Smart Farming Solutions"}
            </Text>
          </View>
        </View>

        <LocationCard />
        {!locationLoading && <WeatherCard />}

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Services</Text>

          <FeatureCard
            icon={<Leaf color="#4CAF50" size={32} />}
            title="Crop Prediction"
            description="Get AI-powered crop recommendations"
            onPress={handleCropPrediction}
          />

          <FeatureCard
            icon={<Text style={styles.diseaseIcon}>🔬</Text>}
            title="Disease Detection"
            description="Identify plant diseases instantly"
            onPress={() =>
              Alert.alert(
                "Coming Soon",
                "Disease detection feature will be available soon!",
              )
            }
          />

          <FeatureCard
            icon={<FileText color="#2196F3" size={32} />}
            title="Government Policies"
            description="Stay updated with agri policies"
            onPress={() => router.push({ pathname: "/govpol" })} 
          />
        </View>
      </ScrollView>
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Your District</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={KERALA_DISTRICTS}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.districtItem,
                    location?.district === item.name &&
                      styles.districtItemSelected,
                  ]}
                  onPress={() => selectManualLocation(item)}
                >
                  <Text
                    style={[
                      styles.districtName,
                      location?.district === item.name &&
                        styles.districtNameSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {location?.district === item.name && (
                    <Text style={styles.selectedCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.detectLocationButton}
              onPress={() => {
                setShowLocationModal(false);
                requestLocationPermission();
              }}
            >
              <MapPin color="white" size={20} />
              <Text style={styles.detectLocationText}>Detect My Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem}>
          <Home color="#4CAF50" size={24} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Leaf color="#9E9E9E" size={24} />
          <Text style={styles.navLabel}>Community</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/profile")}
        >
          <User color="#9E9E9E" size={24} />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  content: { flex: 1 },

  header: {
    backgroundColor: "#4CAF50",
    padding: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "white" },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },

  locationCard: {
    backgroundColor: "white",
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationLoadingText: { marginLeft: 10, color: "#666", fontSize: 14 },
  locationDistrict: { fontSize: 16, fontWeight: "bold", color: "#333" },
  locationState: { fontSize: 12, color: "#666" },
  locationButtonText: {
    marginLeft: 8,
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "600",
  },

  weatherCard: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  weatherHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  weatherEmoji: { fontSize: 60, marginRight: 20 },
  weatherInfo: { flex: 1 },
  temperature: { fontSize: 36, fontWeight: "bold", color: "#333" },
  weatherDesc: { fontSize: 16, color: "#666", textTransform: "capitalize" },
  weatherDetails: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  detailItem: { alignItems: "center", flex: 1 },
  detailDivider: { width: 1, backgroundColor: "#E0E0E0" },
  detailLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    textAlign: "center",
  },
  detailValue: { fontSize: 20, fontWeight: "bold", color: "#333" },
  errorText: { textAlign: "center", color: "#999", padding: 20 },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  closeButton: { fontSize: 28, color: "#999", fontWeight: "300" },
  districtItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  districtItemSelected: { backgroundColor: "#E8F5E9" },
  districtName: { fontSize: 16, color: "#333" },
  districtNameSelected: { fontWeight: "bold", color: "#4CAF50" },
  selectedCheck: { fontSize: 20, color: "#4CAF50", fontWeight: "bold" },
  detectLocationButton: {
    backgroundColor: "#4CAF50",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  detectLocationText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },

  navbar: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navLabel: { fontSize: 12, color: "#9E9E9E", marginTop: 4 },
  navLabelActive: { color: "#4CAF50", fontWeight: "600" },

  featuresSection: { padding: 16, paddingBottom: 100 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  featureCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureIcon: { marginBottom: 12 },
  diseaseIcon: { fontSize: 32 },
  featureTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  featureDesc: { fontSize: 14, color: "#666" },
});
