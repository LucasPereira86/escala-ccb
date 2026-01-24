/**
 * AI SCHEDULER LOGIC
 * Automates the schedule generation respecting availability constraints.
 */

const AI_SCHEDULER = {
    /**
     * Main function to generate the schedule
     */
    generate: function (month, year, members, previousSchedule) {
        console.log(`🤖 AI: Starting generation for ${month}/${year}`);

        const services = getServiceDays(month, year);
        const schedule = [];

        // Helper to track usage count for load balancing
        const usageCount = {};

        // Initialize counts
        [...members.porteiros, ...members.auxiliares].forEach(m => {
            usageCount[m.id] = 0;
        });

        // Initialize processed set to avoid re-processing forced partners who are already assigned
        // In this simple greedy approach, we just check if a role is already filled in the `schedule` array.

        for (let i = 0; i < services.length; i++) {
            const service = services[i];
            const serviceDate = service.date;
            const isWednesday = serviceDate.getDay() === 3;
            const isSunday = serviceDate.getDay() === 0;
            const isSundayMorning = isSunday && service.type.includes('Manhã');
            const isSundayNight = isSunday && !service.type.includes('Manhã');

            const serviceContext = {
                date: serviceDate,
                isWednesday,
                isSundayMorning,
                isSundayNight
            };

            // Helpers to check if slot is already filled (by partner logic)
            const isRoleFilled = (role) => schedule.some(s => s.serviceIndex === i && s.role === role);

            // 1. Select Porteiros (Irmãos)
            // Porteiro Principal
            if (!isRoleFilled('porteiroPrincipal')) {
                const porteiroP = this.selectBestCandidate(
                    members.porteiros,
                    usageCount,
                    serviceContext,
                    schedule,
                    services,
                    'porteiroPrincipal',
                    i,
                    members
                );

                if (porteiroP) {
                    this.assignMember(schedule, usageCount, i, 'porteiroPrincipal', porteiroP);
                    this.handlePartnerAssignment(porteiroP, members, schedule, usageCount, i, services);
                }
            }

            // Porteiro Lateral
            if (!isRoleFilled('porteiroLateral')) {
                // Get exclusion list (people already in this service)
                const currentServiceMembers = schedule.filter(s => s.serviceIndex === i).map(s => s.member.id);

                const porteiroL = this.selectBestCandidate(
                    members.porteiros,
                    usageCount,
                    serviceContext,
                    schedule,
                    services,
                    'porteiroLateral',
                    i,
                    members,
                    currentServiceMembers
                );

                if (porteiroL) {
                    this.assignMember(schedule, usageCount, i, 'porteiroLateral', porteiroL);
                    this.handlePartnerAssignment(porteiroL, members, schedule, usageCount, i, services);
                }
            }

            // 2. Select Auxiliares (Irmãs)
            // Auxiliar Principal
            if (!isRoleFilled('auxiliarPrincipal')) {
                const currentServiceMembers = schedule.filter(s => s.serviceIndex === i).map(s => s.member.id);

                const auxiliarP = this.selectBestCandidate(
                    members.auxiliares,
                    usageCount,
                    serviceContext,
                    schedule,
                    services,
                    'auxiliarPrincipal',
                    i,
                    members,
                    currentServiceMembers
                );

                if (auxiliarP) {
                    this.assignMember(schedule, usageCount, i, 'auxiliarPrincipal', auxiliarP);
                    this.handlePartnerAssignment(auxiliarP, members, schedule, usageCount, i, services);
                }
            }

            // Auxiliar Lateral
            if (!isRoleFilled('auxiliarLateral')) {
                const currentServiceMembers = schedule.filter(s => s.serviceIndex === i).map(s => s.member.id);

                const auxiliarL = this.selectBestCandidate(
                    members.auxiliares,
                    usageCount,
                    serviceContext,
                    schedule,
                    services,
                    'auxiliarLateral',
                    i,
                    members,
                    currentServiceMembers
                );

                if (auxiliarL) {
                    this.assignMember(schedule, usageCount, i, 'auxiliarLateral', auxiliarL);
                    this.handlePartnerAssignment(auxiliarL, members, schedule, usageCount, i, services);
                }
            }
        }

        return schedule;
    },

    assignMember: function (schedule, usageCount, serviceIndex, role, member) {
        usageCount[member.id]++;
        schedule.push({ serviceIndex, role, member });
    },

    /**
     * If member has a partner, force assign them if possible
     */
    handlePartnerAssignment: function (member, allMembers, schedule, usageCount, serviceIndex, services) {
        if (!member.partnerId) return;

        // Find partner
        const partnerId = member.partnerId;
        // Search in all lists
        let partner = allMembers.porteiros.find(m => m.id == partnerId);
        let partnerType = 'porteiro';
        if (!partner) {
            partner = allMembers.auxiliares.find(m => m.id == partnerId);
            partnerType = 'auxiliar';
        }

        if (!partner) return; // Partner not found (maybe deleted)

        // Check if partner is already scheduled in this service
        if (schedule.some(s => s.serviceIndex === serviceIndex && s.member.id == partner.id)) return;

        // Determine available role for partner
        const isRoleFilled = (r) => schedule.some(s => s.serviceIndex === serviceIndex && s.role === r);

        let targetRole = null;
        if (partnerType === 'porteiro') {
            if (!isRoleFilled('porteiroPrincipal')) targetRole = 'porteiroPrincipal';
            else if (!isRoleFilled('porteiroLateral')) targetRole = 'porteiroLateral';
        } else {
            if (!isRoleFilled('auxiliarPrincipal')) targetRole = 'auxiliarPrincipal';
            else if (!isRoleFilled('auxiliarLateral')) targetRole = 'auxiliarLateral';
        }

        if (targetRole) {
            // Force assign
            // Note: We bypass strict availability check for partner in this simplified version 
            // assuming if one can go, the other can too (Couples usually travel together)
            // But we SHOULD check frequency if required.
            this.assignMember(schedule, usageCount, serviceIndex, targetRole, partner);
        }
    },

    /**
     * Selects the best candidate for a specific slot
     */
    selectBestCandidate: function (candidates, usageCount, context, currentSchedule, allServices, roleName, serviceIndex, allMembers, excludeIds = []) {
        // Filter available candidates
        let available = candidates.filter(c => {
            // 1. Check strict exclusion (already picked in this service)
            if (excludeIds.includes(c.id)) return false;

            // 2. Check Availability Rules (Day of week, etc)
            if (!this.checkAvailability(c, context)) return false;

            // 3. Check Frequency (Once per month)
            if (c.oncePerMonth && usageCount[c.id] >= 1) return false;

            // 4. Partner Constraint Logic (Crucial!)
            // If I have a partner, I can ONLY be selected if my partner is ALSO available 
            // AND there is a slot for them.
            if (c.partnerId) {
                const partnerId = c.partnerId;

                // Find partner object
                let partner = allMembers.porteiros.find(m => m.id == partnerId);
                let partnerType = 'porteiro';
                if (!partner) {
                    partner = allMembers.auxiliares.find(m => m.id == partnerId);
                    partnerType = 'auxiliar';
                }

                if (partner) {
                    // Check if partner is already scheduled in this service (then it's ok, we join them)
                    const partnerInService = currentSchedule.find(s => s.serviceIndex === serviceIndex && s.member.id == partner.id);
                    if (partnerInService) return true;

                    // If partner NOT in service, check if they CAN be added
                    // Does partner have a free slot?
                    const isRoleFilled = (r) => currentSchedule.some(s => s.serviceIndex === serviceIndex && s.role === r);
                    let partnerHasSlot = false;
                    if (partnerType === 'porteiro') {
                        partnerHasSlot = !isRoleFilled('porteiroPrincipal') || !isRoleFilled('porteiroLateral');
                    } else {
                        partnerHasSlot = !isRoleFilled('auxiliarPrincipal') || !isRoleFilled('auxiliarLateral');
                    }

                    if (!partnerHasSlot) return false; // No room for partner

                    // Check partner availability for this time
                    // (Recursive check might cause loop, so we do simpler check)
                    if (!this.checkAvailability(partner, context)) return false;
                    if (partner.oncePerMonth && usageCount[partner.id] >= 1) return false;
                }
            }

            return true;
        });

        if (available.length === 0) return null;

        // Shuffle for randomness
        available = available.sort(() => Math.random() - 0.5);

        // Sort by usage (Least used first)
        available.sort((a, b) => {
            const countA = usageCount[a.id] || 0;
            const countB = usageCount[b.id] || 0;
            return countA - countB;
        });

        // Pick the top one
        return available[0];
    },

    /**
     * Checks if a member is available for a specific context
     */
    checkAvailability: function (member, context) {
        // If no availability object, assume available
        if (!member.availability) return true;

        const { isWednesday, isSundayMorning, isSundayNight } = context;

        // Check Wednesday
        if (isWednesday && !member.availability.wednesday) return false;

        // Check Sunday Morning
        if (isSundayMorning && !member.availability.sunday_morning) return false;

        // Check Sunday Night
        if (isSundayNight && !member.availability.sunday_night) return false;

        return true;
    }
};
