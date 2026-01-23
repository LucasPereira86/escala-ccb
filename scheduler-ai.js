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

        // Sort services to prioritize special events if needed (standard order for now)
        // We'll process day by day
        
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

            // 1. Select Porteiros (Irmãos)
            const porteiroP = this.selectBestCandidate(
                members.porteiros, 
                usageCount, 
                serviceContext, 
                schedule, 
                'porteiro'
            );
            
            if (porteiroP) {
                usageCount[porteiroP.id]++;
                schedule.push({ serviceIndex: i, role: 'porteiroPrincipal', member: porteiroP });
            }

            const porteiroL = this.selectBestCandidate(
                members.porteiros, 
                usageCount, 
                serviceContext, 
                schedule, 
                'porteiro',
                [porteiroP?.id] // Exclude the one just picked
            );

            if (porteiroL) {
                usageCount[porteiroL.id]++;
                schedule.push({ serviceIndex: i, role: 'porteiroLateral', member: porteiroL });
            }

            // 2. Select Auxiliares (Irmãs)
            const auxiliarP = this.selectBestCandidate(
                members.auxiliares, 
                usageCount, 
                serviceContext, 
                schedule, 
                'auxiliar'
            );

            if (auxiliarP) {
                usageCount[auxiliarP.id]++;
                schedule.push({ serviceIndex: i, role: 'auxiliarPrincipal', member: auxiliarP });
            }

            const auxiliarL = this.selectBestCandidate(
                members.auxiliares, 
                usageCount, 
                serviceContext, 
                schedule, 
                'auxiliar',
                [auxiliarP?.id]
            );

            if (auxiliarL) {
                usageCount[auxiliarL.id]++;
                schedule.push({ serviceIndex: i, role: 'auxiliarLateral', member: auxiliarL });
            }
        }

        return schedule;
    },

    /**
     * Selects the best candidate for a specific slot
     */
    selectBestCandidate: function (candidates, usageCount, context, currentSchedule, type, excludeIds = []) {
        // Filter available candidates
        let available = candidates.filter(c => {
            // 1. Check strict exclusion
            if (excludeIds.includes(c.id)) return false;

            // 2. Check Availability Rules
            if (!this.checkAvailability(c, context)) return false;

            // 3. Check "Back-to-back" services (avoid same person 2 services in a row if possible)
            // Ideally we check if they served in the previous service
            // For now, let's just ensure they aren't already scheduled in THIS service (handled by excludeIds)
            
            return true;
        });

        if (available.length === 0) return null;

        // Shuffle for randomness if counts are equal
        available = available.sort(() => Math.random() - 0.5);

        // Sort by usage (Least used first)
        available.sort((a, b) => {
            const countA = usageCount[a.id] || 0;
            const countB = usageCount[b.id] || 0;
            return countA - countB;
        });

        // Pick the top one (least used)
        return available[0];
    },

    /**
     * Checks if a member is available for a specific context
     */
    checkAvailability: function (member, context) {
        // If no explicit availability set, assume compatible (backward compatibility)
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
