import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { router } from 'expo-router';
import { Edit3, FileText, Home, Leaf, MapPin, User } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Kerala districts with coordinates
const KERALA_DISTRICTS = [
  { name: 'Thiruvananthapuram', lat: 8.5241, lon: 76.9366, rainfall: 538 },
  { name: 'Kollam', lat: 8.5432, lon: 76.3841, rainfall: 424 },
  { name: 'Pathanamthitta', lat: 9.2648, lon: 76.7870, rainfall: 518 },
  { name: 'Alappuzha', lat: 9.4981, lon: 76.3388, rainfall: 464.3 },
  { name: 'Kottayam', lat: 9.5916, lon: 76.5222, rainfall: 549.6 },
  { name: 'Idukki', lat: 9.9189, lon: 77.1025, rainfall: 413.4 },
  { name: 'Ernakulam', lat: 10.0000, lon: 76.1555, rainfall: 466.4 },
  { name: 'Thrissur', lat: 10.5276, lon: 76.2144, rainfall: 371.5 },
  { name: 'Palakkad', lat: 10.7867, lon: 76.6548, rainfall: 281.4 },
  { name: 'Malappuram', lat: 11.0510, lon: 76.0711, rainfall: 306.4 },
  { name: 'Kozhikode', lat: 11.1588, lon: 75.4904, rainfall: 347.4 },
  { name: 'Wayanad', lat: 11.6854, lon: 76.1320, rainfall: 253.5 },
  { name: 'Kannur', lat: 11.5245, lon: 75.2504, rainfall: 311.4 },
  { name: 'Kasaragod', lat: 12.4996, lon: 75.0077, rainfall: 304.5 },
];

const KERALA_RAINFALL_DATA: { [key: string]: number } = {
  'Thiruvananthapuram': 538,
  'Kollam': 424,
  'Pathanamthitta': 518,
  'Alappuzha': 464.3,
  'Kottayam': 549.6,
  'Idukki': 413.4,
  'Ernakulam': 466.4,
  'Thrissur': 371.5,
  'Palakkad': 281.4,
  'Malappuram': 306.4,
  'Kozhikode': 347.4,
  'Wayanad': 253.5,
  'Kannur': 311.4,
  'Kasaragod': 304.5,
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
  const locationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initializeLocation();
    
    return () => {
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
      }
    };
  }, []);

  const setDefaultLocation = async () => {
    const defaultDistrict = KERALA_DISTRICTS.find(d => d.name === 'Idukki')!;
    const locationData: LocationData = {
      lat: defaultDistrict.lat,
      lon: defaultDistrict.lon,
      district: defaultDistrict.name,
      state: 'Kerala',
      isManual: true,
    };
    
    await AsyncStorage.setItem('userLocation', JSON.stringify(locationData));
    setLocation(locationData);
    setLocationLoading(false);
    fetchWeatherData(locationData);
  };

  const initializeLocation = async () => {
    try {
      // Set timeout for location detection (15 seconds)
      locationTimeoutRef.current = setTimeout(() => {
        console.log('Location timeout - setting default location');
        setDefaultLocation();
      }, 15000);

      const storedLocation = await AsyncStorage.getItem('userLocation');
      
      if (storedLocation) {
        const loc = JSON.parse(storedLocation);
        setLocation(loc);
        setLocationLoading(false);
        fetchWeatherData(loc);
        
        if (locationTimeoutRef.current) {
          clearTimeout(locationTimeoutRef.current);
        }
      } else {
        await requestLocationPermission();
      }
    } catch (error) {
      console.error('Error initializing location:', error);
      setDefaultLocation();
    }
  };

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'AgriSmart needs access to your location to provide weather data.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getCurrentLocation();
        } else {
          setDefaultLocation();
        }
      } else {
        getCurrentLocation();
      }
    } catch (err) {
      console.warn(err);
      setDefaultLocation();
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      async (position) => {
        if (locationTimeoutRef.current) {
          clearTimeout(locationTimeoutRef.current);
        }
        
        const { latitude, longitude } = position.coords;
        await reverseGeocode(latitude, longitude);
      },
      (error) => {
        console.error('Location error:', error);
        setDefaultLocation();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
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
      
      await AsyncStorage.setItem('userLocation', JSON.stringify(locationData));
      setLocation(locationData);
      setLocationLoading(false);
      
      fetchWeatherData(locationData);
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setDefaultLocation();
    }
  };

  const selectManualLocation = async (district: typeof KERALA_DISTRICTS[0]) => {
    const locationData: LocationData = {
      lat: district.lat,
      lon: district.lon,
      district: district.name,
      state: 'Kerala',
      isManual: true,
    };
    
    await AsyncStorage.setItem('userLocation', JSON.stringify(locationData));
    setLocation(locationData);
    setShowLocationModal(false);
    fetchWeatherData(locationData);
  };

  const fetchWeatherData = async (loc: LocationData) => {
    try {
      setLoading(true);
      const WEATHER_API_KEY = "118abeee9772432cbf6102936250912";
      
      const weatherResponse = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${loc.lat},${loc.lon}&aqi=no&hour=8`
      );
      const weatherData = await weatherResponse.json();

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
      setWeather({
        temp: 28,
        humidity: 75,
        rainfall: KERALA_RAINFALL_DATA[loc.district] || 2500,
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
        <View style={styles.locationContainer}>
          <View style={styles.locationInfo}>
            <MapPin color="#4CAF50" size={20} />
            <View style={styles.locationText}>
              <Text style={styles.locationDistrict}>{location.district}</Text>
              <Text style={styles.locationState}>
                {location.state}
                {location.isManual && ' (Manual)'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setShowLocationModal(true)}
            style={styles.editButton}
          >
            <Edit3 color="#4CAF50" size={18} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          onPress={() => setShowLocationModal(true)} 
          style={styles.locationButton}
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
    
    router.push({
      pathname: '/croppred',
      params: {
        temperature: weather.temp,
        humidity: weather.humidity,
        rainfall: weather.rainfall,
        district: location.district,
      }
    });
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

      {/* Location Selection Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
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
                    location?.district === item.name && styles.districtItemSelected
                  ]}
                  onPress={() => selectManualLocation(item)}
                >
                  <Text style={[
                    styles.districtName,
                    location?.district === item.name && styles.districtNameSelected
                  ]}>
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
  locationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flex: 1,
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
  editButton: {
    padding: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 28,
    color: '#999',
    fontWeight: '300',
  },
  districtItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  districtItemSelected: {
    backgroundColor: '#E8F5E9',
  },
  districtName: {
    fontSize: 16,
    color: '#333',
  },
  districtNameSelected: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  selectedCheck: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  detectLocationButton: {
    backgroundColor: '#4CAF50',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectLocationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
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
});
