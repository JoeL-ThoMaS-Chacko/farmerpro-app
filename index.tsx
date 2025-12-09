import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from "@react-navigation/native";
import { router } from 'expo-router';
import { FileText, Home, Leaf, MapPin, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Cumulative rainfall data for Kerala districts (in mm)
const KERALA_RAINFALL_DATA: { [key: string]: number } = {
  'Thiruvananthapuram': 1827,
  'Kollam': 2945,
  'Pathanamthitta': 3055,
  'Alappuzha': 2763,
  'Kottayam': 2945,
  'Idukki': 3055,
  'Ernakulam': 3014,
  'Thrissur': 3055,
  'Palakkad': 2500,
  'Malappuram': 2945,
  'Kozhikode': 3114,
  'Wayanad': 2945,
  'Kannur': 3114,
  'Kasaragod': 3592,
};

interface LocationData {
  lat: number;
  lon: number;
  district: string;
  state: string;
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
  const navigation = useNavigation();

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      // Check if location is stored
      const storedLocation = await AsyncStorage.getItem('userLocation');
      
      if (storedLocation) {
        const loc = JSON.parse(storedLocation);
        setLocation(loc);
        setLocationLoading(false);
        fetchWeatherData(loc);
      } else {
        // Request location permission and get location
        await requestLocationPermission();
      }
    } catch (error) {
      console.error('Error initializing location:', error);
      setLocationLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'AgriSmart needs access to your location to provide weather data and crop recommendations.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getCurrentLocation();
        } else {
          Alert.alert('Permission Denied', 'Location permission is required for this app to function properly.');
          setLocationLoading(false);
        }
      } else {
        // For iOS, request permission is handled differently
        getCurrentLocation();
      }
    } catch (err) {
      console.warn(err);
      setLocationLoading(false);
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await reverseGeocode(latitude, longitude);
      },
      (error) => {
        console.error('Location error:', error);
        Alert.alert('Location Error', 'Unable to get your location. Please try again.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await response.json();
      
      const locationData: LocationData = {
        lat,
        lon,
        district: data.address.county || data.address.state_district || 'Unknown',
        state: data.address.state || 'Kerala',
      };
      
      // Store location
      await AsyncStorage.setItem('userLocation', JSON.stringify(locationData));
      setLocation(locationData);
      setLocationLoading(false);
      
      // Fetch weather data
      fetchWeatherData(locationData);
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setLocationLoading(false);
    }
  };

  const fetchWeatherData = async (loc: LocationData) => {
    try {
      setLoading(true);
      const WEATHER_API_KEY = "118abeee9772432cbf6102936250912";
      
      const weatherResponse = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${loc.lat},${loc.lon}&aqi=no`
      );
      const weatherData = await weatherResponse.json();

      // Get rainfall data from our local data
      const rainfall = KERALA_RAINFALL_DATA[loc.district] || 2500;

      const weatherInfo: WeatherData = {
        temp: Math.round(weatherData.current.temp_c),
        humidity: weatherData.current.humidity,
        rainfall: rainfall,
        condition: weatherData.current.condition.text,
        description: weatherData.current.condition.text.toLowerCase()
      };

      setWeather(weatherInfo);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching weather:", error);
      // Demo data fallback
      setWeather({
        temp: 28,
        humidity: 75,
        rainfall: 2500,
        condition: "Clear",
        description: "clear sky",
      });
      setLoading(false);
    }
  };

  const getWeatherEmoji = (condition: string) => {
    const weatherMap: { [key: string]: string } = {
      Clear: "☀️",
      Clouds: "☁️",
      Rain: "🌧️",
      Drizzle: "🌦️",
      Thunderstorm: "⛈️",
      Snow: "❄️",
      Mist: "🌫️",
      Fog: "🌫️",
    };
    return weatherMap[condition] || "🌤️";
  };

  const LocationCard = () => (
    <View style={styles.locationCard}>
      {locationLoading ? (
        <View style={styles.locationLoading}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.locationLoadingText}>Getting your location...</Text>
        </View>
      ) : location ? (
        <View style={styles.locationInfo}>
          <MapPin color="#4CAF50" size={20} />
          <View style={styles.locationText}>
            <Text style={styles.locationDistrict}>{location.district}</Text>
            <Text style={styles.locationState}>{location.state}</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={requestLocationPermission} style={styles.locationButton}>
          <MapPin color="#4CAF50" size={20} />
          <Text style={styles.locationButtonText}>Enable Location</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const WeatherCard = () => (
    <View style={styles.weatherCard}>
      {loading || locationLoading ? (
        <View style={styles.weatherLoading}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading weather data...</Text>
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

  const handleCropPredictionNavigation = () => {
    if (!weather || !location) {
      Alert.alert('Please Wait', 'Weather data is still loading. Please try again in a moment.');
      return;
    }
    
   const navigateToCropPrediction = () => {
  router.push('/croppred');
};
};
  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AgriSmart</Text>
          <Text style={styles.headerSubtitle}>Smart Farming Solutions</Text>
        </View>

        <LocationCard />
        {!locationLoading && <WeatherCard />}

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Services</Text>
          
          <FeatureCard
            icon={<Leaf color="#4CAF50" size={32} />}
            title="Crop Prediction"
            description="Get AI-powered crop recommendations"
            onPress={handleCropPredictionNavigation}
          />
          
          <FeatureCard
            icon={<Text style={styles.diseaseIcon}>🔬</Text>}
            title="Disease Detection"
            description="Identify plant diseases instantly"
            onPress={() => Alert.alert("Coming Soon", "Disease detection feature will be available soon!")}
          />

          <FeatureCard
            icon={<FileText color="#2196F3" size={32} />}
            title="Government Policies"
            description="Stay updated with agri policies"
            onPress={() => Alert.alert("Coming Soon", "Policy advisory feature will be available soon!")}
          />
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem}>
          <Home color="#4CAF50" size={24} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Leaf color="#9E9E9E" size={24} />
          <Text style={styles.navLabel}>My Farm</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <User color="#9E9E9E" size={24} />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: "#4CAF50",
    padding: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLoadingText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: 10,
  },
  locationDistrict: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  locationState: {
    fontSize: 12,
    color: '#666',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  locationButtonText: {
    marginLeft: 8,
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  weatherCard: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  weatherLoading: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  weatherHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  weatherEmoji: {
    fontSize: 60,
    marginRight: 20,
  },
  weatherInfo: {
    flex: 1,
  },
  temperature: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
  },
  weatherDesc: {
    fontSize: 16,
    color: "#666",
    textTransform: "capitalize",
  },
  weatherDetails: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  detailItem: {
    alignItems: "center",
    flex: 1,
  },
  detailDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
  },
  detailLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  errorText: {
    textAlign: "center",
    color: "#999",
    padding: 20,
  },
  featuresSection: {
    padding: 16,
    paddingBottom: 100,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    marginBottom: 12,
  },
  diseaseIcon: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: "#666",
  },
  navbar: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 12,
    color: "#9E9E9E",
    marginTop: 4,
  },
  navLabelActive: {
    color: "#4CAF50",
    fontWeight: "600",
  },
});