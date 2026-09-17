import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GeofencesModule } from '../geofences/geofences.module';

import { AirportsService } from './airports/airports.service';
import { AirportsController } from './airports/airports.controller';

import { AircraftService } from './aircraft/aircraft.service';
import { AircraftController } from './aircraft/aircraft.controller';

import { FlightCrewService } from './crew/flight-crew.service';
import { FlightCrewController } from './crew/flight-crew.controller';

import { FlightsService } from './flights/flights.service';
import { FlightsController } from './flights/flights.controller';

import { AirRoutingService } from './routing/air-routing.service';
import { FlightSimulationService } from './movements/flight-simulation.service';
import { FlightMovementsService } from './movements/flight-movements.service';
import { FlightMovementsController } from './movements/flight-movements.controller';

import { AirCarbonService } from './intelligence/air-carbon.service';
import { FlightEtaService } from './intelligence/flight-eta.service';
import { CrewFlightScoringService } from './intelligence/crew-flight-scoring.service';
import { AirportSlotService } from './intelligence/airport-slot.service';
import { FlightDutyService } from './intelligence/flight-duty.service';
import { FlightPdfReportService } from './reports/flight-pdf-report.service';

@Module({
  imports: [
    SupabaseModule,
    GeocodingModule,
    RealtimeModule,
    NotificationsModule,
    GeofencesModule,
  ],
  controllers: [
    AirportsController,
    AircraftController,
    FlightCrewController,
    FlightsController,
    FlightMovementsController,
  ],
  providers: [
    AirportsService,
    AircraftService,
    FlightCrewService,
    FlightsService,
    AirRoutingService,
    FlightSimulationService,
    FlightMovementsService,
    AirCarbonService,
    FlightEtaService,
    CrewFlightScoringService,
    AirportSlotService,
    FlightDutyService,
    FlightPdfReportService,
  ],
  exports: [
    AirportsService,
    AircraftService,
    FlightCrewService,
    FlightsService,
    AirRoutingService,
    FlightSimulationService,
    FlightMovementsService,
    AirCarbonService,
    FlightEtaService,
    CrewFlightScoringService,
    AirportSlotService,
    FlightDutyService,
    FlightPdfReportService,
  ],
})
export class AirwaysModule {}
