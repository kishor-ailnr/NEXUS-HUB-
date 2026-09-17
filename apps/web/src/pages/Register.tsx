import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { INDIA_LOCATIONS, isValidOrgMode, OrgMode } from '@nexus-ways/shared';
import { BackButton } from '../components/BackButton';
import { useAuthStore } from '../store/authStore';
import { NotFound } from './NotFound';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, AlertCircle, Building2, UserCheck, Truck, TrainFront, Plane, Ship } from 'lucide-react';
import { toast } from 'sonner';

const MODE_ICONS: Record<OrgMode, React.ComponentType<{ className?: string }>> = {
  roadways: Truck,
  railways: TrainFront,
  airways: Plane,
  seaways: Ship,
};

export const Register: React.FC = () => {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [country] = useState('India');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [address, setAddress] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validate mode parameter
  if (!isValidOrgMode(mode)) {
    return <NotFound />;
  }

  const currentMode = mode as OrgMode;
  const modeTitle = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
  const ModeIcon = MODE_ICONS[currentMode] || Truck;

  // Available districts based on selected state
  const availableDistricts = useMemo(() => {
    if (!selectedState) return [];
    const stateObj = INDIA_LOCATIONS.find((s) => s.state === selectedState);
    return stateObj ? stateObj.districts : [];
  }, [selectedState]);

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value);
    setSelectedDistrict('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedState || !selectedDistrict) {
      const msg = 'Please select a valid State and District.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      await register({
        fullName,
        email,
        password,
        orgName,
        mode: currentMode,
        country,
        state: selectedState,
        district: selectedDistrict,
        address,
      });

      toast.success(`Organization and Manager account created for ${modeTitle}!`);
      navigate(`/${currentMode}/dashboard`, { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Registration failed. Please check the details and try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col justify-between p-4 sm:p-6">
      <div className="w-full">
        <BackButton fallbackTo="/" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center my-6">
        <Card className="w-full max-w-xl border-slate-200 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1 font-semibold text-navy bg-navy/10 border-navy/20">
                <ModeIcon className="w-3.5 h-3.5 text-navy" />
                <span>{modeTitle} Onboarding</span>
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold text-navy">Register {modeTitle} Organization</CardTitle>
            <CardDescription className="text-sm text-slate-500 mt-1">
              Set up your managerial credentials and organization profile for {modeTitle.toLowerCase()} dispatch
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {errorMsg && (
              <div className="p-3 bg-status-critical-light border border-status-critical/30 rounded-lg flex items-center gap-2 text-status-critical-dark text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-status-critical" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User Account Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800 font-semibold text-sm">
                  <UserCheck className="w-4 h-4 text-navy" />
                  <span>Primary Manager Account</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="reg-fullname">Full Name</Label>
                    <Input
                      id="reg-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reg-email">Work Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="manager@logistics.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-password">Password (min 6 characters)</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Organization & Location Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800 font-semibold text-sm">
                  <Building2 className="w-4 h-4 text-navy" />
                  <span>Organization & Location Profile</span>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-orgname">Organization / Fleet Name</Label>
                  <Input
                    id="reg-orgname"
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={`e.g. Apex ${modeTitle} Solutions Ltd`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Country: Fixed to India */}
                  <div className="space-y-1">
                    <Label htmlFor="reg-country">Country</Label>
                    <select
                      id="reg-country"
                      disabled
                      value={country}
                      className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg text-slate-600 cursor-not-allowed"
                    >
                      <option value="India">India</option>
                    </select>
                  </div>

                  {/* State: Cascading dropdown */}
                  <div className="space-y-1">
                    <Label htmlFor="reg-state">State / UT</Label>
                    <select
                      id="reg-state"
                      required
                      value={selectedState}
                      onChange={handleStateChange}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy focus:outline-none"
                    >
                      <option value="">-- Select State --</option>
                      {INDIA_LOCATIONS.map((loc) => (
                        <option key={loc.state} value={loc.state}>
                          {loc.state}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* District: Cascading dropdown */}
                  <div className="space-y-1">
                    <Label htmlFor="reg-district">District</Label>
                    <select
                      id="reg-district"
                      required
                      disabled={!selectedState}
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {selectedState ? '-- Select District --' : '-- Select State First --'}
                      </option>
                      {availableDistricts.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-address">Registered Address / Head Office</Label>
                  <Input
                    id="reg-address"
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Plot 42, Logistics Hub, Industrial Corridor"
                  />
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering Organization...</span>
                  </>
                ) : (
                  `Create ${modeTitle} Organization & Manager Account`
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link
                to={`/${currentMode}/login`}
                className="font-semibold text-navy hover:underline focus:outline-none"
              >
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs text-slate-400 py-2">
        NEXUS WAYS &bull; {modeTitle} Division Onboarding
      </div>
    </div>
  );
};
