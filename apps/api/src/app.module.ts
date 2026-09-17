import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { RoutingModule } from './routing/routing.module';
import { DriversModule } from './drivers/drivers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { GeofencesModule } from './geofences/geofences.module';
import { ConvoysModule } from './convoys/convoys.module';
import { HosModule } from './hos/hos.module';
import { TrackingModule } from './tracking/tracking.module';
import { TripsModule } from './trips/trips.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';
import { RailwaysModule } from './railways/railways.module';
import { AirwaysModule } from './airways/airways.module';
import { SeawaysModule } from './seaways/seaways.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    SupabaseModule,
    GeocodingModule,
    RealtimeModule,
    AuthModule,
    HealthModule,
    NotificationsModule,
    DashboardModule,
    AdminModule,
    RoutingModule,
    DriversModule,
    VehiclesModule,
    GeofencesModule,
    ConvoysModule,
    HosModule,
    TrackingModule,
    TripsModule,
    IntelligenceModule,
    AiModule,
    ReportsModule,
    RailwaysModule,
    AirwaysModule,
    SeawaysModule,
    PlatformModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
