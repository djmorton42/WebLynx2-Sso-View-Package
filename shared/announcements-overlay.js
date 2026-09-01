/**
 * Shared announcement + sponsor-banner behaviour for announcements views.
 *
 * Usage:
 *   <script src="/views/shared/weblynx-helpers.js"></script>
 *   <script src="/views/shared/announcements-overlay.js"></script>
 *   <script>
 *     WebLynx.startAnnouncementOverlay({
 *       sponsorJsonPath: '/views/announcements/sponsors/sponsor-text.json'
 *     });
 *   </script>
 */
(function (WebLynx) {
  function setAnnouncementVisible(visible) {
    const announcementElement = document.getElementById('announcement-message');
    const announcementSection = document.querySelector('.announcement');

    if (announcementSection) {
      if (visible) {
        announcementSection.removeAttribute('hidden');
      } else {
        announcementSection.setAttribute('hidden', '');
      }
    }

    if (!announcementElement) {
      return;
    }

    if (visible) {
      announcementElement.style.display = '';
    } else {
      announcementElement.style.display = 'none';
    }
  }

  function updateAnnouncementData() {
    WebLynx.updateRaceData((data, error) => {
      const announcementElement = document.getElementById('announcement-message');
      if (!announcementElement) {
        return;
      }

      if (error) {
        console.error('Error fetching race data:', error);
        setAnnouncementVisible(false);
        return;
      }

      WebLynx.applyViewConfig(data);
      WebLynx.applyMeetIdentity(data);

      if (data.announcementMessage && data.announcementMessage.trim()) {
        announcementElement.textContent = data.announcementMessage;
        announcementElement.className = 'announcement-message';
        setAnnouncementVisible(true);
      } else {
        setAnnouncementVisible(false);
      }
    });
  }

  function initializeSponsorSlides() {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.sponsor-slide');
    const totalSlides = slides.length;

    if (totalSlides === 0) {
      return;
    }

    function rotateSponsorSlides() {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % totalSlides;
      slides[currentSlide].classList.add('active');
    }

    setInterval(rotateSponsorSlides, 5000);
  }

  async function loadSponsorData(sponsorJsonPath) {
    const sponsorsRight = document.querySelector('.sponsors-right');
    const sponsorsBanner = document.querySelector('.sponsors-banner');
    const sponsorsLeft = document.querySelector('.sponsors-left');
    const sponsorTitle = document.querySelector('.sponsor-title');
    const sponsorSlides = document.querySelector('.sponsor-slides');

    try {
      const response = await fetch(sponsorJsonPath);
      if (!response.ok) {
        throw new Error('File not found');
      }

      const data = await response.json();

      if (!data.title || !data.slides || !Array.isArray(data.slides)) {
        throw new Error('Invalid JSON structure');
      }

      if (sponsorTitle) {
        sponsorTitle.textContent = data.title;
      }

      if (sponsorSlides) {
        sponsorSlides.innerHTML = '';
        data.slides.forEach((slide, index) => {
          if (!slide.sponsors || !Array.isArray(slide.sponsors)) {
            return;
          }

          const slideDiv = document.createElement('div');
          slideDiv.className = 'sponsor-slide';
          if (index === 0) {
            slideDiv.classList.add('active');
          }
          slideDiv.setAttribute('data-slide', String(index));

          slide.sponsors.forEach((sponsor) => {
            const sponsorDiv = document.createElement('div');
            sponsorDiv.className = 'sponsor-name';
            sponsorDiv.textContent = sponsor;
            slideDiv.appendChild(sponsorDiv);
          });

          sponsorSlides.appendChild(slideDiv);
        });
      }

      if (sponsorsRight) {
        sponsorsRight.style.display = 'block';
      }
      if (sponsorsBanner) {
        sponsorsBanner.classList.remove('single-column');
      }
      if (sponsorsLeft) {
        sponsorsLeft.classList.remove('full-width');
      }

      initializeSponsorSlides();
    } catch (error) {
      console.log('Sponsor JSON file not found, using single column layout:', error);
      if (sponsorsRight) {
        sponsorsRight.style.display = 'none';
      }
      if (sponsorsBanner) {
        sponsorsBanner.classList.add('single-column');
      }
      if (sponsorsLeft) {
        sponsorsLeft.classList.add('full-width');
      }
    }
  }

  WebLynx.startAnnouncementOverlay = function (options) {
    const opts = options || {};
    WebLynx.startAutoUpdate(
      updateAnnouncementData,
      WebLynx.DEFAULT_UPDATE_INTERVAL_MS,
      'place',
      'slowUpdateInterval'
    );
    if (opts.sponsorJsonPath) {
      loadSponsorData(opts.sponsorJsonPath);
    }
  };
})(window.WebLynx);
